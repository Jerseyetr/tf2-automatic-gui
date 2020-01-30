const Schema = require('../app/schema.js');
const { quality, wears, qualities, effects, killstreaks, skins } = require('../app/data.js');
const SKU = require('tf2-sku');

module.exports = getSKU;


function getSKU(search) {
	if (search.includes(';')) { // too lazy
		return SKU.fromObject(
			Schema.fixItem(
				SKU.fromString(
					search
				)
			)
		);
	}
	
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
	
	let name;

	if (search.includes('backpack.tf/stats')) { // input is a stats page URL
		searchParts = search
			.substring(search.indexOf('stats'))
			.split('/');

		name = decodeURI(searchParts[2]).replace('| ', ''); // Decode and just remove | by default since bptf has that for skins, not *that* good but decent
		
		const quality = decodeURI(searchParts[1]);
		
		item.craftable = searchParts[4] === 'Craftable' ? true : false;

		if (quality == 'Strange Unusual') {
			item.quality = 5;
			item.quality2 = 11;
		} else if (quality == 'Strange Haunted') {
			item.quality = 13;
			item.quality2 = 11;
		} else {
			item.quality = quality[searchParts[1]];
		}

		if (item.quality == 5) {
			item.effect = parseInt(searchParts[5]);
		}
	} else { // Input is an item name
		name = search;

		// Check for quality if its not a bptf link
		if (name.includes('Strange Haunted')) {
			item.quality = 13;
			item.quality2 = 11;
		} else {
			for (i = 0; i < qualities.length; i++) {
				if (name.includes(qualities[i])) {
					name = name.replace(qualities[i] + ' ', '');
					item.quality = quality[qualities[i]];
					
					break;
				}
			}
		}

		// Check for effects if not a bptf link
		for (i = 0; i < effects.length; i++) {
			if (name.includes(effects[i])) {
				name = name.replace(effects[i] + ' ', '');
				item.effect = data.effect[effects[i]];
				// Has an effect, check if its strange. If so, set strange elevated
				if (item.quality == 11) {
					item.quality = 5;
					item.quality2 = 11;
				}
				
				break;
			}
		}

		// Check if craftable if not a bptf link
		if (name.includes('Non-Craftable')) {
			name = name.replace('Non-Craftable ', '');
			item.craftable = false;
		}
	}

	// Always check for wear
	for (i = 0; i < wears.length; i++) {
		if (name.includes(wears[i])) {
			name = name.replace(' ' + wears[i], '');
			item.wear = data.wear[wears[i]];
			
			break;
		}
	}

	// Always check for skin if it has a wear
	if (item.wear) {
		for (i = 0; i < skins.length; i++) {
			if (name.includes(skins[i])) {
				name = name.replace(skins[i] + ' ', '');
				item.paintkit = data.skin[skins[i]];
				
				if (item.effect) { // override decorated quality if it is unusual
					item.quality = 5;
				}
				
				break;
			}
		}
	}

	// Always check for killstreak
	for (i = 0; i < killstreaks.length; i++) {
		if (name.includes(killstreaks[i])) {
			name = name.replace(killstreaks[i] + ' ', '');
			item.killstreak = data.killstreak[killstreaks[i]];
			
			break;
		}
	}

	// Always check for Australium
	if (name.includes('Australium') && item.quality === 11) {
		name = name.replace('Australium ', '');
		item.australium = true;
	}

	// Always get defindex
	let defindex;
	if (name.includes('War Paint')) {
		defindex = 16102; // Defindexes for war paints get corrected when fixing sku
	} else {
		// TODO: Handle correctly
		defindex = getDefindex(name);
	}

	if (defindex === false) {
		console.log('Item is not priced and couldn\'t get defindex: ' + search);
		return false;
	}

	item.defindex = defindex;
	
	return SKU.fromObject(
		Schema.fixItem(item)
	);
}

function getDefindex(search) {
	const schema = Schema.get();
	const { items } = schema.raw.schema;
	
	for (let i = 0; i < items.length; i++) {
		// eslint-disable-next-line camelcase
		const { item_name, defindex } = items[i];

		// eslint-disable-next-line camelcase
		if (item_name === search || item_name === search.replace('The ', '')) {
			return defindex;
		}
	}

	return false;
}
