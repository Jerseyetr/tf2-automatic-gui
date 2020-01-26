console.log("tf2-automatic-gui v" + require('./package.json').version + " is starting...")
const path = require('path');
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const fs = require('fs');
const tf2Currencies = require('tf2-currencies');

const Schema = require('./schema.js');
const utils = require('./utils.js');

if (!fs.existsSync('./config/pricelist.json')) {
	throw new Error('Missing pricelist - ' +
		'Please put your pricelist file in the config folder');
}

// Set image/css/js whatever path
app.use(express.static(path.join(__dirname, '/assets')));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
	extended: false
}));

// Routes
app.get('/', (req, res) => {
	let removed = parseInt(req.query.removed);
	if (removed) {
		if (removed == 0) {
			utils.renderPricelist(res, "danger", "Somehow not able to remove items!");
			return;
		}
		utils.renderPricelist(res, "success", "Removed " + removed + (removed == 1 ? " item" : " items") + " from your pricelist");
		return;
	}

	utils.renderPricelist(res, "primary", "none");
})

// Add a list of items to the pricelist
app.post('/add-items', async (req, res) => {
	req.body.input = req.body.input.split(/\r?\n/);
	req.body.input.forEach(function(item, index) {
		if (req.body.max - req.body.min < 1) {
			utils.renderPricelist(res, 'warning', 'The maximum stock must be atleast one higher than the minimum');
			return;
		}

		if (item.includes('classifieds')) {
			utils.renderPricelist(res, 'danger', 'Please use the items stats page or full name, not the classifieds link');
			return;
		}
	})
	
	utils.addItems(res, req.body.input, {
		intent: parseInt(req.body.intent),
		min: parseInt(req.body.min),
		max: parseInt(req.body.max)
	});
});

app.post('/changeItem', (req, res) => {
	if (req.body.max <= req.body.min) {
		utils.renderPricelist(res, 'warning', 'The maximum stock must be atleast one higher than the minimum');
		return;
	}

	// lower sell keys
	if (req.body.sellkeys < req.body.buykeys) {
		utils.renderPricelist(res, 'warning', 'The buy price must be higher than the sell price');
		return;
	}
	// Same amount of keys, lower or equal sell metal
	if (req.body.sellkeys === req.body.buykeys && req.body.sellmetal <= req.body.buymetal) {
		utils.renderPricelist(res, 'warning', 'The buy price must be higher than the sell price');
		return;
	}
	
	let sellvalues = new tf2Currencies({keys: req.body.sellkeys, metal: req.body.sellmetal.replace(',', '.')}).toJSON();
	let buyvalues = new tf2Currencies({keys: req.body.buykeys, metal: req.body.buymetal.replace(',', '.')}).toJSON();

	let item = {
		sku: req.body.sku,
		sell: sellvalues,
		buy: buyvalues,
		intent: parseInt(req.body.intent),
		min: parseInt(req.body.min),
		max: parseInt(req.body.max)
	}

	let autoprice = req.body.autoprice == 'true';
	item.autoprice = autoprice;
	if (autoprice) {
		item.time = 0;
	} else {
		item.time = new Date().getTime();
	}
	
	utils.changeSingleItem(res, item);
});

// Remove selected items from pricelist
app.post('/pricelist', async (req, res) => {
	const items = req.body.list;
	let removed = await utils.removeItems(items);
	// SEND DATA WITH RES.JSON AND USE THAT TO REDIRECT IN QS IN CLIENTJS
	if (removed == false) {
		res.json({
			removed: 0
		});
		return;
	}

	res.json({
		removed: removed
	});
	return;
});

// Burn the pricelist with fire
app.post('/clearPricelist', (req, res) => {
	utils.clearPricelist(res);
})

// Startup
if (fs.existsSync('./config/schema.json')) {
	Schema.getSchema(function(err, schema) { // For setting the schema in schema.js
		app.listen(3000, function() { //listen on port 3000
			console.log("listening on port 3000");
			require("open")("http://localhost:3000/");
		});
	})
} else {
	Schema.getSchemaFromApi(function(err, schema) {
		fs.writeFileSync('./config/schema.json', JSON.stringify(schema));
		app.listen(3000, function() { //listen on port 3000
			console.log("listening on port 3000");
			require("open")("http://localhost:3000/");
		});
	})
}