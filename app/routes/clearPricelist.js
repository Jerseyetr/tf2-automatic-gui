const express = require('express');
const router = express.Router();
const pricelist = require('../pricelist');
const renderPricelist = require('../../utils/renderPricelist');

router.post('/', (req, res) => {
	pricelist
		.clear()
		.then(() => {
			renderPricelist({
				res,
				type: 'success',
				message: 'Pricelist has been cleared'
			});
		})
		.catch((err) => {
			throw err;
		});
});

module.exports = router;
