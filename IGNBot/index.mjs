import * as dotenv from 'dotenv'
import Discord from 'discord.js'
import {Low, JSONFile} from 'lowdb'
import { join , dirname } from 'path'
import { fileURLToPath } from 'url'

// config environment
dotenv.config()
const client = new Discord.Client()
const __dirname = dirname(fileURLToPath(import.meta.url))
const file = join(__dirname, 'db.json')
const adapter = new JSONFile(file)
const db = new Low(adapter)
await db.read()

// connect beep beep boop
await client.login(process.env.DISCORD_TOKEN.trim())

const createEmbed = (user,userdb) => {
    let msg = new Discord.MessageEmbed()
        .setColor('#0099ff')
        .setTitle("IGN's for " + user.username)
	userdb.accounts.forEach(account => msg.addField(account.title, account.name))
	return msg
}

// function to handle a new message to the bot
const handleNewMessage = async message => {
	if (message.content.startsWith('!whois') || message.content.startsWith('!setign') || message.content.startsWith('!addign')) {
        console.log('New message and bot was mentioned in', message.channel.name)

        const mentions = [...(message.mentions.users.filter(user => !user.bot))]

		if(message.content.startsWith('!whois')) {
			if (mentions.length === 0) {
				const msg = message.content.substring(7)
				const user = findByIgn(msg)
				if(user) {
					const discorduser = await client.users.fetch(user.id)
					message.channel.send('Found user ' + discorduser.toString())
					displayIgn(discorduser, message.channel)
				} else {
					message.channel.send('Could not find a user with ign ' + msg)
				}
			} else {
				mentions.forEach(mention => displayIgn(mention[1], message.channel))
			}
		} else if(message.content.startsWith('!setign')){
			setIgn(message.author, message.content)
			message.channel.send('updated user ' + message.author.toString())
		} else if(message.content.startsWith('!addign')) {
			addIgn(message.author, message.content)
			message.channel.send('updated user ' + message.author.toString())
		}
    }
}

const displayIgn = (user, channel) => {
    const userdb = db.data.users
        .find(u => u.id === user.id)

    if (userdb) {
        channel.send(createEmbed(user,userdb))
    } else {
        channel.send('Could not find user ' + user.username)
    }
}

// set ign's in db
const setIgn = (user,message) => {
	let index = db.data.users.findIndex(u => u.id === user.id)
	if (index > -1)
		db.data.users.splice(index,1)
	db.data.users.push({"id": user.id, "accounts": parseAccounts(message)})
	db.write()
}

//add ign to existing account
const addIgn = (user,message) => {
    const userdb = db.data.users
        .find(u => u.id === user.id)
	if(userdb) {
		userdb.accounts = userdb.accounts.concat(parseAccounts(message))
		db.write()
	}
}

const findByIgn = message => {
	return db.data.users
		.find(u => u.accounts.some(a => a.name === message.trim()))
}

const parseAccounts = message => {
	message = message.substr(8) //remove !setign and !addign
	let spl = message.split(',') //different accounts seperated by ,
	let accounts = []
	spl.forEach(s => {
		s = s.trim().split(':')
		accounts.push({"title": s[0], "name": s[1]})
	})
	return accounts
}

// Discord listeners
client.on('message', async message => {
    if (message.author.bot || message.content.includes('@here') || message.content.includes('@everyone'))
        return false

	return handleNewMessage(message)
})

// Let's go
console.log('Ready!')
client.user.setActivity('!whois, !setign, !addign', { type: 'LISTENING' })
