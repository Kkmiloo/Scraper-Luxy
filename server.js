const puppeteer = require('puppeteer');
const express = require("express");
const { MongoClient } = require('mongodb');
const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config()

const uri = process.env.MONGO_URI;
const token = process.env.TOKEN_TL;
const chatId = process.env.CHAT_ID;
const bot = new TelegramBot(token, { polling: true });
const tymer = 100000
const app = express();

app.set("port", process.env.PORT || 5000);

app.get("/", (req, res) => {
    (async () => {
        initialization();
    })()
        .catch(err => res.sendStatus(500))
});

app.listen(process.env.PORT || 3001, '0.0.0.0', () => {
    console.log("Server is running.");
});

const client = new MongoClient(uri);
const database = client.db('luxy');
const viajes = database.collection('viajes');

const initialization = async () => {
    const browser = await puppeteer.launch({
        'args': [
            '--no-sandbox',
            '--disable-setuid-sandbox'
        ]
    });


    const page = await browser.newPage()
    await page.setViewport({ width: 1920, height: 1080 })
    await page.goto('https://affiliate.luxyride.com/#/rides/Available')
    await page.screenshot({ path: 'example.png' })
    const loginInput = await page.$('#root > div > div > div > div > div.loginBody > form > div.card_custom > div:nth-child(1) > input[type=text]')
    const passwordInput = await page.$('#root > div > div > div > div > div.loginBody > form > div.card_custom > div:nth-child(2) > input[type=password]')
    await loginInput.type(process.env.CORREO)
    await passwordInput.type(process.env.PASS)
    await page.click('#root > div > div > div > div > div.loginBody > form > div.card_custom > div.text-center.submitBtn > button')
    await page.waitForTimeout(1000);
    await page.goto('https://affiliate.luxyride.com/#/rides/Available')
    await page.waitForTimeout(1000);

    checkWeb(page)
    setInterval(async function (page) {

        await page.waitForTimeout(1000);
        await page.goto('https://affiliate.luxyride.com/#/rides/Available')
        await page.waitForTimeout(1000);
        checkWeb(page)

    }, tymer, page)
}


const checkData = async (id) => {
    try {
        const query = { "tripId": id };
        const result = await viajes.findOne(query);
        if (result) {
            return true
        }
        return false

    } catch (error) {
        console.error(error);
    }
}


const insertData = async (objs) => {
    try {
        await viajes.insertMany(objs)

    } catch (error) {
        console.error(error);
    }
}

const scanTable = async (page) => {
    await page.waitForSelector(".react-bs-container-body > table > tbody > tr");
    const tableTr = await page.$$('.react-bs-container-body > table > tbody > tr')
    const tableTrGood = tableTr.filter((x, i) => i % 2 == 0)
    let dataToInsert = await Promise.all(
        tableTrGood
            .map(async (item) => {

                const tripIdItem = await item.$('td:nth-child(4)')
                const pickUpDateItem = await item.$('td:nth-child(6)')
                const pickUpItem = await item.$('td:nth-child(7)')
                const dropOffItem = await item.$('td:nth-child(8)')
                const distanceItem = await item.$('td:nth-child(10)')
                const totalpayItem = await item.$('td:nth-child(11)')

                const tripId = await page.evaluate(item => item.innerText, tripIdItem)
                const pickUpDate = await page.evaluate(item => item.innerText, pickUpDateItem)
                const pickUp = await page.evaluate(item => item.innerText, pickUpItem)
                const dropOff = await page.evaluate(item => item.innerText, dropOffItem)
                const distance = await page.evaluate(item => item.innerText, distanceItem)
                const totalpay = await page.evaluate(item => item.innerText, totalpayItem)

                let isInCollection = await checkData(tripId)
                console.log(isInCollection);
                const viajeItem = { tripId, pickUpDate, pickUp, dropOff, distance, totalpay }

                if (!isInCollection) {
                    return viajeItem;
                }
            })
    )

    dataToInsert = dataToInsert.filter(Boolean)

    return dataToInsert;
}


const checkWeb = async (page) => {
    const data = await scanTable(page)
    if (data.length > 0) {
        insertData(data)
        bot.sendMessage(chatId, JSON.stringify(data, null, "\t"))
    } else {
        console.log('nada que insertar');
    }
}

//initialization()


