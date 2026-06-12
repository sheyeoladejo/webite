if (!customElements.get("product-info")) {
	customElements.define(
		"product-info",
		class ProductInfo extends HTMLElement {
			quantityInput = undefined;
			quantityForm = undefined;
			onVariantChangeUnsubscriber = undefined;
			cartUpdateUnsubscriber = undefined;
			cleanSizeChartObserver = undefined;
			abortController = undefined;
			pendingRequestUrl = null;
			preProcessHtmlCallbacks = [];
			postProcessHtmlCallbacks = [];

			constructor() {
				super();

				this.quantityInput = this.querySelector(".quantity__input");
			}

			connectedCallback() {
				this.initializeProductSwapUtility();

				this.onVariantChangeUnsubscriber = subscribe(
					PUB_SUB_EVENTS.optionValueSelectionChange,
					this.handleOptionValueChange.bind(this),
				);

				this.initQuantityHandlers();
				this.syncDynamicCheckoutVisibilityFromCurrentState();
				this.remountCleanSizeChart();
				this.observeCleanSizeChartMount();
				this.dispatchEvent(
					new CustomEvent("product-info:loaded", { bubbles: true }),
				);
			}

			addPreProcessCallback(callback) {
				this.preProcessHtmlCallbacks.push(callback);
			}

			initQuantityHandlers() {
				if (!this.quantityInput) return;

				this.quantityForm = this.querySelector(".product-form__quantity");
				if (!this.quantityForm) return;

				this.setQuantityBoundries();
				if (!this.dataset.originalSection) {
					this.cartUpdateUnsubscriber = subscribe(
						PUB_SUB_EVENTS.cartUpdate,
						this.fetchQuantityRules.bind(this),
					);
				}
			}

			disconnectedCallback() {
				this.onVariantChangeUnsubscriber();
				this.cartUpdateUnsubscriber?.();
				this.cleanSizeChartObserver?.disconnect();
			}

			initializeProductSwapUtility() {
				this.preProcessHtmlCallbacks.push((html) =>
					html
						.querySelectorAll(".scroll-trigger")
						.forEach((element) =>
							element.classList.add("scroll-trigger--cancel"),
						),
				);
				this.postProcessHtmlCallbacks.push((newNode) => {
					window?.Shopify?.PaymentButton?.init();
					this.syncDynamicCheckoutVisibilityFromCurrentState();
					window?.ProductModel?.loadShopifyXR();
					this.remountCleanSizeChart();
				});
			}

			handleOptionValueChange({
				data: { event, target, selectedOptionValues },
			}) {
				if (!this.contains(event.target)) return;

				this.resetProductFormState();

				const productUrl =
					target.dataset.productUrl ||
					this.pendingRequestUrl ||
					this.dataset.url;
				this.pendingRequestUrl = productUrl;
				const shouldSwapProduct = this.dataset.url !== productUrl;
				const shouldFetchFullPage =
					this.dataset.updateUrl === "true" && shouldSwapProduct;

				this.renderProductInfo({
					requestUrl: this.buildRequestUrlWithParams(
						productUrl,
						selectedOptionValues,
						shouldFetchFullPage,
					),
					targetId: target.id,
					callback: shouldSwapProduct
						? this.handleSwapProduct(productUrl, shouldFetchFullPage)
						: this.handleUpdateProductInfo(productUrl),
				});
			}

			resetProductFormState() {
				const productForm = this.productForm;
				productForm?.toggleSubmitButton(true);
				productForm?.handleErrorMessage();
			}

			handleSwapProduct(productUrl, updateFullPage) {
				return (html) => {
					this.productModal?.remove();

					const selector = updateFullPage
						? "product-info[id^='MainProduct']"
						: "product-info";
					const variant = this.getSelectedVariant(html.querySelector(selector));
					this.updateURL(productUrl, variant?.id);

					if (updateFullPage) {
						document.querySelector("head title").innerHTML =
							html.querySelector("head title").innerHTML;

						HTMLUpdateUtility.viewTransition(
							document.querySelector("main"),
							html.querySelector("main"),
							this.preProcessHtmlCallbacks,
							this.postProcessHtmlCallbacks,
						);
					} else {
						HTMLUpdateUtility.viewTransition(
							this,
							html.querySelector("product-info"),
							this.preProcessHtmlCallbacks,
							this.postProcessHtmlCallbacks,
						);
					}
				};
			}

			renderProductInfo({ requestUrl, targetId, callback }) {
				this.abortController?.abort();
				this.abortController = new AbortController();

				fetch(requestUrl, { signal: this.abortController.signal })
					.then((response) => response.text())
					.then((responseText) => {
						this.pendingRequestUrl = null;
						const html = new DOMParser().parseFromString(
							responseText,
							"text/html",
						);
						callback(html);
					})
					.then(() => {
						// set focus to last clicked option value
						document.querySelector(`#${targetId}`)?.focus();
					})
					.catch((error) => {
						if (error.name === "AbortError") {
							console.log("Fetch aborted by user");
						} else {
							console.error(error);
						}
					});
			}

			getSelectedVariant(productInfoNode) {
				const selectedVariant = productInfoNode.querySelector(
					"variant-selects [data-selected-variant]",
				)?.innerHTML;
				return !!selectedVariant ? JSON.parse(selectedVariant) : null;
			}

			buildRequestUrlWithParams(
				url,
				optionValues,
				shouldFetchFullPage = false,
			) {
				const params = [];

				!shouldFetchFullPage && params.push(`section_id=${this.sectionId}`);

				if (optionValues.length) {
					params.push(`option_values=${optionValues.join(",")}`);
				}

				return `${url}?${params.join("&")}`;
			}

			updateOptionValues(html) {
				this.parkCleanSizeChart();

				const variantSelects = html.querySelector("variant-selects");
				if (variantSelects) {
					HTMLUpdateUtility.viewTransition(
						this.variantSelectors,
						variantSelects,
						this.preProcessHtmlCallbacks,
						[() => this.remountCleanSizeChart()],
					);
				} else {
					this.remountCleanSizeChart();
				}
			}

			parkCleanSizeChart() {
				const host = this.querySelector("[data-clean-size-chart-host]");
				const mount = this.querySelector(
					"[data-size-chart-spacer] .Clean_Size_Chart",
				);
				if (!host || !mount || host.contains(mount)) return;

				host.appendChild(mount);
				this.syncCleanSizeChartVisibility();
			}

			remountCleanSizeChart() {
				const host = this.querySelector("[data-clean-size-chart-host]");
				const spacer = this.querySelector("[data-size-chart-spacer]");
				if (!host || !spacer) return;

				let mount = host.querySelector(".Clean_Size_Chart");
				if (!mount) {
					mount = document.createElement("div");
					mount.className = "Clean_Size_Chart";
					host.appendChild(mount);
				}

				spacer.appendChild(mount);
				this.reinjectCleanSizeChartIfEmpty(mount);
				this.syncCleanSizeChartVisibility();
				this.observeCleanSizeChartMount();
			}

			syncCleanSizeChartVisibility() {
				const spacer = this.querySelector("[data-size-chart-spacer]");
				const mount = spacer?.querySelector(".Clean_Size_Chart");
				if (!spacer) return;

				spacer.classList.toggle(
					"product-form__size-chart--has-content",
					!!mount?.hasChildNodes(),
				);
			}

			observeCleanSizeChartMount() {
				this.cleanSizeChartObserver?.disconnect();

				const mount =
					this.querySelector("[data-size-chart-spacer] .Clean_Size_Chart") ||
					this.querySelector("[data-clean-size-chart-host] .Clean_Size_Chart");
				if (!mount) return;

				this.cleanSizeChartObserver = new MutationObserver(() => {
					this.syncCleanSizeChartVisibility();
				});
				this.cleanSizeChartObserver.observe(mount, {
					childList: true,
					subtree: true,
				});
			}

			reinjectCleanSizeChartIfEmpty(mount) {
				if (mount.hasChildNodes()) return;

				const template = document.querySelector("#ccpops-trigger-container");
				if (!template) return;

				const clone = template.cloneNode(true);
				mount.appendChild(clone);

				const trigger = mount.querySelector(".ccpops-trigger");
				const reference = document.querySelector(".ccpops-trigger");
				if (!trigger || !reference?.onclick) return;

				trigger.onclick = reference.onclick;
				const popupId = reference.parentElement?.getAttribute(
					"data-ccpops-trigger",
				);
				if (popupId) {
					clone.setAttribute("data-ccpops-trigger", popupId);
				}
			}

			handleUpdateProductInfo(productUrl) {
				return (html) => {
					const variant = this.getSelectedVariant(html);

					this.pickupAvailability?.update(variant);
					this.updateOptionValues(html);
					this.updateURL(productUrl, variant?.id);
					this.updateVariantInputs(variant?.id);

					if (!variant) {
						this.setUnavailable();
						return;
					}

					this.updateMedia(html, variant?.featured_media?.id);

					const updateSourceFromDestination = (
						id,
						shouldHide = (source) => false,
					) => {
						const source = html.getElementById(`${id}-${this.sectionId}`);
						const destination = this.querySelector(
							`#${id}-${this.dataset.section}`,
						);
						if (source && destination) {
							destination.innerHTML = source.innerHTML;
							destination.classList.toggle("hidden", shouldHide(source));
						}
					};

					updateSourceFromDestination("price");
					updateSourceFromDestination("Sku", ({ classList }) =>
						classList.contains("hidden"),
					);
					updateSourceFromDestination(
						"Inventory",
						({ innerText }) => innerText === "",
					);
					updateSourceFromDestination("Volume");
					updateSourceFromDestination("Price-Per-Item", ({ classList }) =>
						classList.contains("hidden"),
					);

					this.updateQuantityRules(this.sectionId, html);
					this.querySelector(
						`#Quantity-Rules-${this.dataset.section}`,
					)?.classList.remove("hidden");
					this.querySelector(
						`#Volume-Note-${this.dataset.section}`,
					)?.classList.remove("hidden");

					this.productForm?.toggleSubmitButton(
						html
							.getElementById(`ProductSubmitButton-${this.sectionId}`)
							?.hasAttribute("disabled") ?? true,
						window.variantStrings.soldOut,
					);
					this.syncDynamicCheckoutVisibility(html);

					publish(PUB_SUB_EVENTS.variantChange, {
						data: {
							sectionId: this.sectionId,
							html,
							variant,
						},
					});
				};
			}

			updateVariantInputs(variantId) {
				this.querySelectorAll(
					`#product-form-${this.dataset.section}, #product-form-installment-${this.dataset.section}`,
				).forEach((productForm) => {
					const input = productForm.querySelector('input[name="id"]');
					input.value = variantId ?? "";
					input.dispatchEvent(new Event("change", { bubbles: true }));
				});
			}

			updateURL(url, variantId) {
				this.querySelector("share-button")?.updateUrl(
					`${window.shopUrl}${url}${variantId ? `?variant=${variantId}` : ""}`,
				);

				if (this.dataset.updateUrl === "false") return;
				window.history.replaceState(
					{},
					"",
					`${url}${variantId ? `?variant=${variantId}` : ""}`,
				);
			}

			setUnavailable() {
				this.productForm?.toggleSubmitButton(
					true,
					window.variantStrings.unavailable,
				);
				this.querySelectorAll(".product-form__buttons").forEach(
					(buttonsRow) => {
						buttonsRow.classList.remove("product-form__buttons--column");
					},
				);
				this.querySelectorAll(
					".product-form__dynamic-checkout, .shopify-payment-button",
				).forEach((dynamicCheckout) => {
					dynamicCheckout.classList.add("hidden");
				});

				const selectors = [
					"price",
					"Inventory",
					"Sku",
					"Price-Per-Item",
					"Volume-Note",
					"Volume",
					"Quantity-Rules",
				]
					.map((id) => `#${id}-${this.dataset.section}`)
					.join(", ");
				document
					.querySelectorAll(selectors)
					.forEach(({ classList }) => classList.add("hidden"));
			}

			updateMedia(html, variantFeaturedMediaId) {
				if (!variantFeaturedMediaId) return;

				const mediaGallerySource = this.querySelector("media-gallery ul");
				const mediaGalleryDestination = html.querySelector(`media-gallery ul`);

				const refreshSourceData = () => {
					if (this.hasAttribute("data-zoom-on-hover")) enableZoomOnHover(2);
					const mediaGallerySourceItems = Array.from(
						mediaGallerySource.querySelectorAll("li[data-media-id]"),
					);
					const sourceSet = new Set(
						mediaGallerySourceItems.map((item) => item.dataset.mediaId),
					);
					const sourceMap = new Map(
						mediaGallerySourceItems.map((item, index) => [
							item.dataset.mediaId,
							{ item, index },
						]),
					);
					return [mediaGallerySourceItems, sourceSet, sourceMap];
				};

				if (mediaGallerySource && mediaGalleryDestination) {
					let [mediaGallerySourceItems, sourceSet, sourceMap] =
						refreshSourceData();
					const mediaGalleryDestinationItems = Array.from(
						mediaGalleryDestination.querySelectorAll("li[data-media-id]"),
					);
					const destinationSet = new Set(
						mediaGalleryDestinationItems.map(({ dataset }) => dataset.mediaId),
					);
					let shouldRefresh = false;

					// add items from new data not present in DOM
					for (let i = mediaGalleryDestinationItems.length - 1; i >= 0; i--) {
						if (
							!sourceSet.has(mediaGalleryDestinationItems[i].dataset.mediaId)
						) {
							mediaGallerySource.prepend(mediaGalleryDestinationItems[i]);
							shouldRefresh = true;
						}
					}

					// remove items from DOM not present in new data
					for (let i = 0; i < mediaGallerySourceItems.length; i++) {
						if (
							!destinationSet.has(mediaGallerySourceItems[i].dataset.mediaId)
						) {
							mediaGallerySourceItems[i].remove();
							shouldRefresh = true;
						}
					}

					// refresh
					if (shouldRefresh)
						[mediaGallerySourceItems, sourceSet, sourceMap] =
							refreshSourceData();

					// if media galleries don't match, sort to match new data order
					mediaGalleryDestinationItems.forEach(
						(destinationItem, destinationIndex) => {
							const sourceData = sourceMap.get(destinationItem.dataset.mediaId);

							if (sourceData && sourceData.index !== destinationIndex) {
								mediaGallerySource.insertBefore(
									sourceData.item,
									mediaGallerySource.querySelector(
										`li:nth-of-type(${destinationIndex + 1})`,
									),
								);

								// refresh source now that it has been modified
								[mediaGallerySourceItems, sourceSet, sourceMap] =
									refreshSourceData();
							}
						},
					);
				}

				// set featured media as active in the media gallery
				this.querySelector(`media-gallery`)?.setActiveMedia?.(
					`${this.dataset.section}-${variantFeaturedMediaId}`,
					true,
				);

				// update media modal
				const modalContent = this.productModal?.querySelector(
					`.product-media-modal__content`,
				);
				const newModalContent = html.querySelector(
					`product-modal .product-media-modal__content`,
				);
				if (modalContent && newModalContent)
					modalContent.innerHTML = newModalContent.innerHTML;
			}

			setQuantityBoundries() {
				const data = {
					cartQuantity: this.quantityInput.dataset.cartQuantity
						? parseInt(this.quantityInput.dataset.cartQuantity)
						: 0,
					min: this.quantityInput.dataset.min
						? parseInt(this.quantityInput.dataset.min)
						: 1,
					max: this.quantityInput.dataset.max
						? parseInt(this.quantityInput.dataset.max)
						: null,
					variantAvailable:
						this.quantityInput.dataset.variantAvailable !== "false",
					step: this.quantityInput.step ? parseInt(this.quantityInput.step) : 1,
				};

				let min = data.min;
				const max =
					data.max === null ? null : Math.max(data.max - data.cartQuantity, 0);
				if (max !== null) min = Math.min(min, max);
				if (data.cartQuantity >= data.min) min = Math.min(min, data.step);
				const shouldDisableQuantity =
					!data.variantAvailable || (max !== null && max <= 0);
				const shouldHideQuantity = shouldDisableQuantity;

				this.quantityInput.min = min;

				if (max !== null) {
					this.quantityInput.max = max;
				} else {
					this.quantityInput.removeAttribute("max");
				}
				this.quantityInput.value = shouldDisableQuantity ? 0 : min;
				this.quantityInput.toggleAttribute("disabled", shouldDisableQuantity);
				this.quantityForm.classList.toggle("hidden", shouldHideQuantity);
				this.quantityForm
					.querySelectorAll(".quantity__button")
					.forEach((button) => {
						button.toggleAttribute("disabled", shouldDisableQuantity);
					});

				publish(PUB_SUB_EVENTS.quantityUpdate, undefined);
			}

			getDynamicCheckoutElement(buttonsRow) {
				return buttonsRow?.querySelector(
					".product-form__dynamic-checkout, .shopify-payment-button",
				);
			}

			applyDynamicCheckoutState(
				currentSubmitButton,
				hideBuyNow,
				isPreorder,
				attempt = 0,
			) {
				const buttonsRow = currentSubmitButton.closest(
					".product-form__buttons",
				);
				buttonsRow?.classList.toggle(
					"product-form__buttons--column",
					isPreorder,
				);
				const dynamicCheckout = this.getDynamicCheckoutElement(buttonsRow);

				if (dynamicCheckout) {
					dynamicCheckout.classList.toggle("hidden", hideBuyNow);
					dynamicCheckout.toggleAttribute("hidden", hideBuyNow);
					dynamicCheckout.style.display = hideBuyNow ? "none" : "";
				} else if (attempt < 5) {
					setTimeout(() => {
						this.applyDynamicCheckoutState(
							currentSubmitButton,
							hideBuyNow,
							isPreorder,
							attempt + 1,
						);
					}, 120);
				}

				const shouldShowDynamicCheckout = !!dynamicCheckout && !hideBuyNow;
				currentSubmitButton.classList.toggle(
					"dynamic-checkout-enabled",
					shouldShowDynamicCheckout,
				);
				currentSubmitButton.classList.toggle(
					"button--secondary",
					shouldShowDynamicCheckout,
				);
				currentSubmitButton.classList.toggle(
					"button--primary",
					!shouldShowDynamicCheckout,
				);
			}

			syncDynamicCheckoutVisibilityFromCurrentState() {
				const currentSubmitButton = this.querySelector(
					`#ProductSubmitButton-${this.dataset.section}`,
				);
				if (!currentSubmitButton) return;

				const hideBuyNow = currentSubmitButton.dataset.hideBuyNow === "true";
				const isPreorder = currentSubmitButton.dataset.isPreorder === "true";
				this.applyDynamicCheckoutState(
					currentSubmitButton,
					hideBuyNow,
					isPreorder,
				);
			}

			syncDynamicCheckoutVisibility(html) {
				const submitButtonId = `ProductSubmitButton-${this.sectionId}`;
				const updatedSubmitButton = html.getElementById(submitButtonId);
				const currentSubmitButton = this.querySelector(
					`#ProductSubmitButton-${this.dataset.section}`,
				);
				if (!updatedSubmitButton || !currentSubmitButton) return;

				const hideBuyNow = updatedSubmitButton.dataset.hideBuyNow === "true";
				const isPreorder = updatedSubmitButton.dataset.isPreorder === "true";
				currentSubmitButton.dataset.hideBuyNow = hideBuyNow ? "true" : "false";
				currentSubmitButton.dataset.isPreorder = isPreorder ? "true" : "false";
				this.applyDynamicCheckoutState(
					currentSubmitButton,
					hideBuyNow,
					isPreorder,
				);
			}

			fetchQuantityRules() {
				const currentVariantId = this.productForm?.variantIdInput?.value;
				if (!currentVariantId) return;

				this.querySelector(
					".quantity__rules-cart .loading__spinner",
				).classList.remove("hidden");
				return fetch(
					`${this.dataset.url}?variant=${currentVariantId}&section_id=${this.dataset.section}`,
				)
					.then((response) => response.text())
					.then((responseText) => {
						const html = new DOMParser().parseFromString(
							responseText,
							"text/html",
						);
						this.updateQuantityRules(this.dataset.section, html);
					})
					.catch((e) => console.error(e))
					.finally(() =>
						this.querySelector(
							".quantity__rules-cart .loading__spinner",
						).classList.add("hidden"),
					);
			}

			updateQuantityRules(sectionId, html) {
				if (!this.quantityInput) return;

				const quantityFormUpdated = html.getElementById(
					`Quantity-Form-${sectionId}`,
				);
				const selectors = [
					".quantity__input",
					".quantity__rules",
					".quantity__label",
				];
				for (let selector of selectors) {
					const current = this.quantityForm.querySelector(selector);
					const updated = quantityFormUpdated.querySelector(selector);
					if (!current || !updated) continue;
					if (selector === ".quantity__input") {
						const attributes = [
							"data-cart-quantity",
							"data-min",
							"data-max",
							"data-variant-available",
							"step",
						];
						for (let attribute of attributes) {
							const valueUpdated = updated.getAttribute(attribute);
							if (valueUpdated !== null) {
								current.setAttribute(attribute, valueUpdated);
							} else {
								current.removeAttribute(attribute);
							}
						}
					} else {
						current.innerHTML = updated.innerHTML;
						if (selector === ".quantity__label") {
							const updatedAriaLabelledBy =
								updated.getAttribute("aria-labelledby");
							if (updatedAriaLabelledBy) {
								current.setAttribute("aria-labelledby", updatedAriaLabelledBy);
								// Update the referenced visually hidden element
								const labelId = updatedAriaLabelledBy;
								const currentHiddenLabel = document.getElementById(labelId);
								const updatedHiddenLabel = html.getElementById(labelId);
								if (currentHiddenLabel && updatedHiddenLabel) {
									currentHiddenLabel.textContent =
										updatedHiddenLabel.textContent;
								}
							}
						}
					}
				}

				this.setQuantityBoundries();
			}

			get productForm() {
				return this.querySelector(`product-form`);
			}

			get productModal() {
				return document.querySelector(`#ProductModal-${this.dataset.section}`);
			}

			get pickupAvailability() {
				return this.querySelector(`pickup-availability`);
			}

			get variantSelectors() {
				return this.querySelector("variant-selects");
			}

			get relatedProducts() {
				const relatedProductsSectionId = SectionId.getIdForSection(
					SectionId.parseId(this.sectionId),
					"related-products",
				);
				return document.querySelector(
					`product-recommendations[data-section-id^="${relatedProductsSectionId}"]`,
				);
			}

			get quickOrderList() {
				const quickOrderListSectionId = SectionId.getIdForSection(
					SectionId.parseId(this.sectionId),
					"quick_order_list",
				);
				return document.querySelector(
					`quick-order-list[data-id^="${quickOrderListSectionId}"]`,
				);
			}

			get sectionId() {
				return this.dataset.originalSection || this.dataset.section;
			}
		},
	);
}
