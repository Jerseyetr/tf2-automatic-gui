new Vue({
	el: '#app',
	data: {
		tradeList: [],
		toShow: 50,
		search: '',
		order: 0
	},
	methods: {
		loadTrades: function() {
			fetch('/trades?json=true')
				.then((response) => {
					return response.json();
				})
				.then((data) => {
					this.tradeList = data.data;
				})
				.catch((error) => {
					console.error('Error:', error);
				});
		},
		scroll() {
			window.onscroll = () => {
				const bottomOfWindow = Math.max(window.pageYOffset, document.documentElement.scrollTop, document.body.scrollTop) + window.innerHeight === document.documentElement.offsetHeight;
				if (bottomOfWindow) {
					this.toShow += 25;
				}
			};
		}
	},
	computed: {
		filteredTrades() {
			return this.tradeList.filter((trade) => {
				return trade.id.indexOf(this.search.toLowerCase()) > -1;
			});
		},
		sortedTrades() {
			return this.filteredTrades.sort((a, b) => {
				if (this.order == 0) {
					return a.time - b.time;
				} else {
					return b.time - a.time;
				}
			});
		}
	},
	created() {
		this.loadTrades();
	},
	mounted() {
		this.scroll();
	}
});
