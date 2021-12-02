const discord = require("discord.js");
const client = new discord.client();


const config = require("./config.json");

client.on("ready" , () => {
    console.log("Our Discord Bot is online");
})


client.login(process.env.token);
