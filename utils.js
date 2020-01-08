const Schema = require('./schema.json');
const data = require('./data.js');
const SKU = require('tf2-sku');
const request = require('request');
const fs = require('fs');
const config = require('./config/config.json');

if (!config.pricesApiToken || config.pricesApiToken == "getThisFromNickInTheDiscordServer") {
    throw new Error("You're missing the prices.tf api token. Join the discord here https://discord.tf2automatic.com/ and request one from Nick");
}

exports.addItem = function(res, search, options) {
    let itemsAdded = 0;
    let itemsFailed = 0;
    let items = [];
    for (i = 0; i < search.length; i++) {
        setTimeout(function(i) {
            let sku;
            if (search[i].includes(';')) { // too lazy
                sku = search[i];
            } else {
                sku = getSKU(search[i]);
            }
            const item = {
                sku: '', 
                enabled: true, 
                autoprice: true, 
                max: 1, 
                min: 0, 
                intent: 2, 
                name: "",
                buy: {},
                sell: {},
                time: 0
            }
            if (sku == false) {
                itemsFailed++
                if (search.length - 1 == i) {
                    exports.renderPricelist(res, 'primary', itemsAdded + (itemsAdded == 1 ? ' item' : ' items') + ' added, ' + itemsFailed + (itemsFailed == 1 ? ' item' : ' items') + ' failed.');
                }
                return;
            }

            getInfo(sku).then((info) => {
                if (!info) {
                    itemsFailed++;
                    if (search.length - 1 == i && itemsAdded === 0) {
                        exports.renderPricelist(res, 'primary', itemsAdded + (itemsAdded == 1 ? ' item' : ' items') + ' added, ' + itemsFailed + (itemsFailed == 1 ? ' item' : ' items') + ' failed.');
                    }
                    return;
                }
                item.sku = info.sku;
                item.name = info.name;
                item.buy = info.buy;
                item.sell = info.sell;
                item.time = info.time;
    
                item.max = options.max;
                item.min = options.min;
                item.intent = options.intent;
                items.push(item);
                itemsAdded++;
                if (search.length - 1 == i) {
                    changePricelist('add', items).then((result) => {
                        if (result > 0) {
                            itemsAdded -= result;
                        }
                        exports.renderPricelist(res, 'primary', itemsAdded + (itemsAdded == 1 ? ' item' : ' items') + ' added, ' + itemsFailed + (itemsFailed == 1 ? ' item' : ' items') + ' failed' + (result > 0 ? ', ' + result + (result == 1 ? ' item was' : ' items were') + ' already in your pricelist.' : '.'));
                    }).catch((err) => {
                        console.log(err);
                        return;
                    })
                }
            }).catch((err) => {
                console.log(err);
                return;
            });
        }, 75 * i, i); // ~13 per second
    }
}

exports.removeItems = function(items) {
    return new Promise((resolve, reject) => {
        if (items.length == 0) {
            return resolve(false)
        }
        if (!Array.isArray(items)) {
            items = [items];
        }
        changePricelist('remove', items).then((result) => {
            if (!result) return resolve(false);
            return resolve(result);
        }).catch((err) => {
            console.log(err);
            return reject(err);
        })
    })
}

function getSKU (search) { 
    const item = {
        defindex: '', 
        quality: 6, 
        craftable: true, 
        killstreak: 0, 
        australium: false, 
        festive: false, 
        effect: null,
        wear: null, 
        paintkit: null, 
        quality2: null 
    };
    if (search.includes('backpack.tf/stats')) { // input is a stats page URL
        search = search.substring(search.indexOf("stats")).split('/');

        let name = decodeURI(search[2]);
        let quality = decodeURI(search[1]); // Decode, has %20 if decorated / dual quality
        if (quality == "Strange Unusual") {
            item.quality = 5;
            item.quality2 = 11;
        } else if (quality == "Strange Haunted") {
            item.quality = 13;
            item.quality2 = 11;
        } else {
            item.quality = data.quality[search[1]];
        }

        for (i = 0; i < data.killstreaks.length; i++) {
            if (name.includes(data.killstreaks[i])) {
                name = name.replace(data.killstreaks[i] + ' ', "");
                item.killstreak = data.killstreak[data.killstreaks[i]];
            }
        }
        if (name.includes('Australium') && search[1] === 'Strange') {
            name = name.replace('Australium ', "");
            item.australium = true;
        }
        if (item.quality == 5) {
            item.effect = parseInt(search[5]);
        }
        for (i = 0; i < data.wears.length; i++) {
            if (name.includes(data.wears[i])) {
                name = name.replace(' ' + data.wears[i], "");
                item.wear = data.wear[data.wears[i]];
            }
        }
        if (item.wear) { // Is a skin, any quality
            for (i = 0; i < data.skins.length; i++) {
                if (name.includes(data.skins[i])) {
                    name = name.replace(data.skins[i] + ' ', "");
                    name = name.replace('| ', '') // Remove | in the bptf link
                    item.paintkit = data.skin[data.skins[i]];
                    if (item.effect) { // override decorated quality if it is unusual
                        item.quality = 5;
                    }
                }
            }
        }
        let defindex;
        if (name.includes("War Paint")) {
            defindex = 16102; // Ok i know they have different defindexes but they get automatically corrected. Bless Nick.
        } else {
            defindex = getDefindex(name);
        }
        if (defindex === false) {
            return false;
        }
        item.defindex = defindex;
        item.craftable = search[4] === 'Craftable' ? true : false;
        return SKU.fromObject(item);
    }
    // handle item name inputs
    let name = search;
    if (name.includes('Non-Craftable')) {
        name = name.replace('Non-Craftable ', "");
        item.craftable = false;
    }
    if (name.includes("Strange Haunted")) {
        item.quality = 13;
        item.quality2 = 11;
    } else {
        for (i = 0; i < data.qualities.length; i++) {
            if (name.includes(data.qualities[i])) {
                name = name.replace(data.qualities[i] + ' ', "");
                item.quality = data.quality[data.qualities[i]];
            }
        }
    }
    for (i = 0; i < data.effects.length; i++) {
        if (name.includes(data.effects[i])) {
            name = name.replace(data.effects[i] + ' ', "");
            item.effect = data.effect[data.effects[i]];
            // Has an effect, check if its strange. If so, set strange elevated
            if (item.quality == 11) {
                item.quality = 5;
                item.quality2 = 11;
            }
        }
    }
    for (i = 0; i < data.skins.length; i++) {
        if (name.includes(data.skins[i])) {
            name = name.replace(data.skins[i] + ' ', "");
            item.paintkit = data.skin[data.skins[i]];
            for (i = 0; i < data.wears.length; i++) {
                if (name.includes(data.wears[i])) {
                    name = name.replace(' ' + data.wears[i], "");
                    item.wear = data.wear[data.wears[i]];
                }
            }
            if (item.effect) { // override decorated quality if it is unusual. Elevated is already set when setting effect
                item.quality = 5;
            }
            item.quality = 15; // default just decorated
        }
    }
    for (i = 0; i < data.killstreaks.length; i++) {
        if (name.includes(data.killstreaks[i])) {
            name = name.replace(data.killstreaks[i] + ' ', "");
            item.killstreak = data.killstreak[data.killstreaks[i]];
        }
    }
    if (name.includes('Australium') && item.quality === 11) {
        name = name.replace('Australium ', "");
        item.australium = true;
    }
    let defindex;
    if (name.includes("War Paint")) {
        defindex = 16102; // Ok i know they have different defindexes but they get automatically corrected. Bless Nick.
    } else {
        defindex = getDefindex(name);
    }
    if (defindex === false) {
        return false;
    }
    item.defindex = defindex;
    return SKU.fromObject(item);
}

function getDefindex(search) {
    const items = Schema.schema.items;
    for (let i = 0; i < items.length; i++) {
        let name = items[i].item_name;
        if (name === search) {
            return items[i].defindex;
        }
    }
    return false;
}

function getInfo(sku) {
    return new Promise((resolve, reject) => {
        request({
            method: "GET",
            json: true,
            uri: "https://api.prices.tf/items/" + sku,
            qs: {
                src: 'bptf'
            },
            headers: {
                'Authorization': 'Token ' + config.pricesApiToken
            }
        }, function(err, response, body) {
            if (err) {
                return reject(err);
            }
            if (body.success == false) {
                if (body.message == 'Unauthorized') {
                    throw new Error("Your prices.tf api token is incorrect. Join the discord here https://discord.tf2automatic.com/ and request one from Nick");
                }
                return resolve(false);
            }
            if (body.buy == null || body.sell == null) {
                return resolve(false);
            }
            return resolve(body);
        });
    });
}

function changePricelist(action, items) {
    return new Promise((resolve, reject) => {
        if (action == 'add') {
            let alreadyAdded = 0;
            fs.readFile('./config/pricelist.json', function(err, data) {
                if (err) {
                    return reject(err);
                }
                let pricelist = JSON.parse(data);
                itemsloop:
                for (j = 0; j < items.length; j++) {
                    for (i = 0; i < pricelist.length; i++) {
                        if (pricelist[i].sku == items[j].sku) {
                            alreadyAdded++
                            if (items.length - 1 == j) {
                                fs.writeFile('./config/pricelist.json', JSON.stringify(pricelist, null, 4), function(err) {
                                    if (err) {
                                        return reject(err);
                                    }
                                    return resolve(alreadyAdded);
                                });
                            }
                            continue itemsloop;
                        }
                    }
                    pricelist.push(items[j]);
                    if (items.length - 1 == j) {
                        fs.writeFile('./config/pricelist.json', JSON.stringify(pricelist, null, 4), function(err) {
                            if (err) {
                                return reject(err);
                            }
                            return resolve(alreadyAdded);
                        });
                    }
                }
            });
        }
        if (action == 'remove') {
            let itemsremoved = 0;
            fs.readFile('./config/pricelist.json', function(err, data) {
                if (err) {
                    return reject(err);
                }
                let pricelist = JSON.parse(data);
                for (i = 0; i < pricelist.length; i++) {
                    for (j = 0; j < items.length; j++) {
                        if (pricelist[i].sku == items[j]) {
                            pricelist.splice(pricelist.indexOf(pricelist[i]), 1);
                            itemsremoved++
                        }
                    }
                }
                fs.writeFile('./config/pricelist.json', JSON.stringify(pricelist, null, 4), function(err) {
                    if (err) {
                        return reject(err);
                    }
                    return resolve(itemsremoved);
                });
            });
        }
    });
}

exports.renderPricelist = function(res, type, msg) {
    fs.readFile('./config/pricelist.json', function (err, data) {
        if (err) throw err;
        res.render('home', {
            type: type,
            msg: msg,
            pricelist: JSON.parse(data)
        });
    });
}

exports.clearPricelist = function(res) {
    fs.writeFile('./config/pricelist.json', '[]', function(err) {
        if (err) {
            console.log(err)
            exports.renderPricelist(res, 'danger', 'Error occured trying to clear the pricelist. See the console for more information');
            return;
        }
        exports.renderPricelist(res, 'success', 'Pricelist has been cleared');
    });
}