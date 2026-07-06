if (!customElements.get("newsletter-modal")) {
	const STORAGE_KEY = "sheye_newsletter_modal_last_shown";
	const SUBSCRIBED_KEY = "sheye_newsletter_subscribed";
	const INTERVAL_MS = 12 * 60 * 60 * 1000;
	const MODAL_ID = "NewsletterModal";

	class NewsletterModal extends HTMLElement {
		connectedCallback() {
			this.modal = document.getElementById(MODAL_ID);
			if (!this.modal) return;

			this.isLoggedIn = this.dataset.customerLoggedIn === "true";
			this.isProductPage = this.dataset.template === "product";

			this.bindCloseTracking();

			if (document.getElementById("NewsletterModal-success")) {
				localStorage.setItem(SUBSCRIBED_KEY, "true");
				this.openModal();
				return;
			}

			if (document.getElementById("NewsletterModal-error")) {
				this.openModal();
				return;
			}

			if (this.shouldAutoShow()) {
				const delay = Number.parseInt(this.dataset.delay || "3", 10) * 1000;
				this.autoShowTimeout = window.setTimeout(() => {
					this.recordShown();
					this.openModal();
				}, delay);
			}
		}

		disconnectedCallback() {
			if (this.autoShowTimeout) window.clearTimeout(this.autoShowTimeout);
		}

		bindCloseTracking() {
			this.modal.addEventListener("click", (event) => {
				const isCloseButton = event.target.closest('[id^="ModalClose-"]');
				const isBackdrop = event.target === this.modal;
				if (isCloseButton || isBackdrop) this.recordShown();
			});

			this.modal.addEventListener("keyup", (event) => {
				if (event.code.toUpperCase() === "ESCAPE") this.recordShown();
			});
		}

		shouldAutoShow() {
			if (this.isLoggedIn) return false;
			if (!this.isProductPage) return false;
			if (localStorage.getItem(SUBSCRIBED_KEY) === "true") return false;

			const lastShown = Number.parseInt(
				localStorage.getItem(STORAGE_KEY) || "0",
				10,
			);
			return Date.now() - lastShown >= INTERVAL_MS;
		}

		openModal(opener) {
			if (!this.modal.hasAttribute("open") && typeof this.modal.show === "function") {
				this.modal.show(opener);
			}
		}

		recordShown() {
			localStorage.setItem(STORAGE_KEY, Date.now().toString());
		}
	}

	customElements.define("newsletter-modal", NewsletterModal);
}
