/*
	gallery.js – loads the photo list and starts the Lens viewer.

	The frontend only knows the contract of GET /api/gallery (see docs/api-contract.md).
	It treats every image URL as an opaque string and never builds storage paths itself.
*/
(function () {
	'use strict';

	var API_URL = '/api/gallery';

	// How categories are shown:
	//   'mixed'   – one list, categories interleaved (round-robin), order inside each category kept.
	//   'grouped' – one list, category after category, in API order.
	// A category menu may come later (see docs/decisions.html, D-011).
	var CATEGORY_MODE = 'mixed';

	var thumbnails = document.getElementById('thumbnails');

	function withCategory(category, image) {
		var copy = {};
		for (var key in image) copy[key] = image[key];
		copy.category = category.id;
		return copy;
	}

	function flatten(data, mode) {
		var categories = (data && Array.isArray(data.categories)) ? data.categories : [];
		var result = [];

		if (mode === 'grouped') {
			categories.forEach(function (c) {
				(c.images || []).forEach(function (img) { result.push(withCategory(c, img)); });
			});
			return result;
		}

		var longest = categories.reduce(function (max, c) {
			return Math.max(max, (c.images || []).length);
		}, 0);

		for (var round = 0; round < longest; round++) {
			categories.forEach(function (c) {
				var img = (c.images || [])[round];
				if (img) result.push(withCategory(c, img));
			});
		}
		return result;
	}

	// Builds the markup Lens expects:
	// <article><a class="thumbnail" href="FULL"><img src="THUMB"></a><h2>Title</h2><p>Text</p></article>
	// Text is set with textContent, so titles from the API cannot inject HTML.
	function renderThumbnails(images) {
		thumbnails.textContent = '';

		images.forEach(function (img) {
			var article = document.createElement('article');
			article.dataset.category = img.category;

			var link = document.createElement('a');
			link.className = 'thumbnail';
			link.href = img.full;
			if (img.position) link.dataset.position = img.position;

			var thumb = document.createElement('img');
			thumb.src = img.thumb;
			thumb.alt = img.title || '';
			thumb.loading = 'lazy';
			thumb.decoding = 'async';
			if (img.thumbWidth && img.thumbHeight) {
				thumb.width = img.thumbWidth;
				thumb.height = img.thumbHeight;
			}

			link.appendChild(thumb);
			article.appendChild(link);

			if (img.title) {
				var h2 = document.createElement('h2');
				h2.textContent = img.title;
				article.appendChild(h2);
			}
			if (img.description) {
				var p = document.createElement('p');
				p.textContent = img.description;
				article.appendChild(p);
			}

			thumbnails.appendChild(article);
		});
	}

	function showMessage(text) {
		thumbnails.textContent = '';
		var p = document.createElement('p');
		p.className = 'gallery-message';
		p.textContent = text;
		thumbnails.appendChild(p);
		document.body.classList.add('no-viewer');
		document.body.classList.remove('is-preload-0', 'is-preload-1', 'is-preload-2');
	}

	// Lens (main.js) reads the thumbnails once when it starts, so it must load after rendering.
	// It also removes the "is-preload" classes on window "load". If that event already fired,
	// we fire it again for Lens.
	function startLens() {
		var script = document.createElement('script');
		script.src = 'assets/js/main.js';
		script.onload = function () {
			if (document.readyState === 'complete') window.jQuery(window).trigger('load');
		};
		document.body.appendChild(script);
	}

	fetch(API_URL, { headers: { Accept: 'application/json' }, cache: 'no-store' })
		.then(function (response) {
			if (!response.ok) throw new Error('GET ' + API_URL + ' failed with HTTP ' + response.status);
			return response.json();
		})
		.then(function (data) {
			var images = flatten(data, CATEGORY_MODE);
			if (images.length === 0) {
				showMessage('No photos yet. Please check back soon.');
				return;
			}
			renderThumbnails(images);
			startLens();
		})
		.catch(function (error) {
			console.error(error);
			showMessage('The photos could not be loaded. Please try again later.');
		});
})();
