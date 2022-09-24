const config = require("./config");
const Pixiv = require("./api");

(async () => {
	const api = new Pixiv(config);

	const login = await api.accessTokenLogin();
	if (login) {
		console.log(`Logged in as ${login}`);

		await api.getAll(); // This will download all available emojis from Pixiv

		/** Uncomment this to download a specific emoji
        This will search and download for emojis with the keyword "gura"

        const res = await api.getEmojisBySearch("gura");
        console.log(`Downloaded ${res.length} emojis`);
        */
	}
})();
