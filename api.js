const got = require("got");
const { accessSync, writeFileSync, mkdirSync, promises: fs } = require("fs");

const clientId = "MOBrBDS8blbauoSck0ZfDbtuzpyT";
const oauthURL = "https://oauth.secure.pixiv.net/auth/token";
const clientSecret = "lsACyCD94FhDUtGTXi3QzcFE2uU1hqtDaKeqrdwj";
const hashSecret = "28c1fdd170a5204386cb1313c7077b34f83e4aaf4aa829ce78c231e05b0bae2c";
const clientTime = `${new Date().toISOString().slice(0, -5)}+00:00`;
const clientHash = require("crypto").createHash("md5").update(String(clientTime + hashSecret))
	.digest("hex");

const data = {
	client_id: clientId,
	client_secret: clientSecret,
	get_secure_url: true
};

const headers = {
	"app-os": "ios",
	"app-os-version": "13.2.0",
	"app-version": "7.7.5",
	"user-agent": "PixivIOSApp/7.7.5 (iOS 13.2.0; iPhone XR)",
	host: "oauth.secure.pixiv.net",
	"accept-language": "en_US",
	"x-client-time": clientTime,
	"x-client-hash": clientHash,
	"content-type": "application/x-www-form-urlencoded",
	"accept-encoding": "gzip"
};

module.exports = (function () {
	return class PixivAPI {
		constructor (config) {
			if (typeof config !== "object") {
				throw new Error("Config must be an object");
			}

			if (!config.refresh_token || !config.cookie) {
				throw new Error("Config must contain refresh_token and cookie");
			}

			try {
				accessSync("./id.txt");
			}
			catch {
				console.log("No id.txt found, creating one");
				writeFileSync("./id.txt", "");
			}

			try {
				accessSync("./emotes");
			}
			catch {
				console.log("No emotes folder found, creating one");
				mkdirSync("./emotes");
			}

			this.emoteList = [];

			this.cookie = config.cookie;
			this.refreshToken = config.refresh_token;
			this.userAgent = config.userAgent ?? null;
			this.hasSavedId = false;
		}

		async accessTokenLogin () {
			if (!this.refreshToken) {
				throw new Error("No access token provided");
			}

			data.refresh_token = this.refreshToken;
			data.grant_type = "refresh_token";

			const res = await got({
				method: "POST",
				url: oauthURL,
				responseType: "json",
				headers,
				form: data
			});

			if (res.statusCode !== 200) {
				throw new Error("Failed to login with access token");
			}

			this.accessToken = res.body.response.access_token;
			this.refreshToken = res.body.response.refresh_token;
			this.expires = res.body.response.expires_in;
			this.loginTime = Date.now();

			const { name } = res.body.user;
			return name;
		}

		async refreshAccessToken () {
			const expire = (Date.now() - this.loginTime) > (this.expires * 900);
			if (expire) {
				data.grant_type = "refresh_token";

				const res = await got({
					method: "POST",
					url: oauthURL,
					responseType: "json",
					headers,
					form: data
				});

				if (res.statusCode !== 200) {
					throw new Error("Failed to refresh access token");
				}

				this.accessToken = res.body.response.access_token;
				this.refreshToken = res.body.response.refresh_token;
			}

			return this.accessToken;
		}

		async getAll () {
			const accessToken = await this.refreshAccessToken();

			const lastId = await fs.readFile("id.txt", "utf8");
			if (lastId === "") {
				const res = await this.requestAPI(accessToken, { lang: "en", filter: "not_mine" });
                
				return res;
			}
			else {
				const id = Number.isInteger(Number(lastId));
				if (!id) {
					throw new Error("Invalid emote ID.");
				}

				this.lastSavedId = lastId;
				const res = await this.requestAPI(accessToken, { lang: "en", filter: "not_mine" });

				return res;
			}
		}

		async getEmojisBySearch (keyword) {
			const accessToken = await this.refreshAccessToken();
			const res = await this.requestAPI(accessToken, {
				filter: "all",
				keyword,
				lang: "en"
			}, { skipSave: true });

			return res;
		}

		async requestAPI (accessToken, params, options = {}) {
			const res = await got({
				url: `https://www.pixiv.net/ajax/special/anniversary15/search_emoji`,
				headers: {
					"User-Agent": this.userAgentType,
					"accept-language": "en-US,en;q=0.9,ja-JP;q=0.8,ja;q=0.7",
					Authorization: `Bearer ${accessToken}`,
					Cookie: this.cookie
				},
				searchParams: params,
				responseType: "json",
				throwHttpErrors: false
			});

			if (res.statusCode !== 200) {
				throw new Error(`Failed to get emojis: ${res.statusCode} ${JSON.stringify(res.body)}`);
			}
			else if (res.body.error) {
				throw new Error(`Failed to get emojis: ${JSON.stringify(res.body)}`);
			}

			const emojis = res.body.body.emojis;
			const emotes = await this.parseEmojis(emojis, options);
			if (emotes === "stopped") {
				return this.emoteList;
			}

			this.emoteList.push(...emotes.success);

			const hasNext = Boolean(res.body.body.hasNext);
			if (hasNext) {
				const lastId = emotes.success[emotes.success.length - 1].id;
				console.log(`Fetched ${emotes.success.length} emojis, last id: ${lastId}`);
				await this.requestAPI(accessToken, { ...params, sinceEmojiId: lastId });
			}
			else {
				return this.emoteList;
			}
		}

		async parseEmojis (emotes, options = {}) {
			if (!Array.isArray(emotes)) {
				throw new Error(`Failed to parse emojis: ${emotes} - ${typeof emotes}`);
			}

			const success = [];
			const failed = [];

			for (const emote of emotes) {
				const emoteObj = {
					id: emote.emojiId,
					name: emote.emojiName,
					url: emote.emojiUrl
				};

				try {
					console.log(`Downloading [${emoteObj.id}] ${emoteObj.name}`);
					const emoteRequest = await got({
						url: emoteObj.url,
						responseType: "buffer",
						throwHttpErrors: false,
						headers: {
							Referer: "https://www.pixiv.net/"
						}
					});

					if (!options.skipSave && !this.hasSavedId) {
						await fs.writeFile("id.txt", emoteObj.id);
						this.hasSavedId = true;
					}
    
					const imgType = emoteRequest.headers["content-type"].split("/")[1];
					const imgBuffer = emoteRequest.body;
					const imgName = `${emoteObj.id}_${emoteObj.name}.${imgType}`;

					if (this.lastSavedId === emoteObj.id) {
						console.log("Found last saved emote, stopping...");
						return "stopped";
					}
    
					await fs.writeFile(`${__dirname}/emotes/${imgName}`, imgBuffer);
					success.push(emoteObj);
				}
				catch {
					failed.push(emote);
				}
			}

			return {
				success,
				failed
			};
		}

		get userAgentType () {
			return (this.userAgent)
				? this.userAgent
				: "PixivIOSApp/7.7.5 (iOS 13.2.0; iPhone XR)";
		}
	};
})();
