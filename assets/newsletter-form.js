const SUBSCRIBED_KEY = "sheye_newsletter_subscribed";

function initNewsletterForms() {
	document.querySelectorAll("form.js-newsletter-ajax").forEach((form) => {
		if (form.dataset.newsletterAjaxBound === "true") return;
		form.dataset.newsletterAjaxBound = "true";
		form.addEventListener("submit", onNewsletterSubmit);
	});
}

function getFeedbackContainer(form) {
	let feedback = form.querySelector("[data-newsletter-feedback]");
	if (!feedback) {
		feedback = document.createElement("div");
		feedback.dataset.newsletterFeedback = "";
		form.appendChild(feedback);
	}
	return feedback;
}

function clearFeedback(form) {
	const feedback = form.querySelector("[data-newsletter-feedback]");
	if (feedback) {
		feedback.hidden = true;
		feedback.innerHTML = "";
	}
	form.querySelector("[data-newsletter-fields]")?.removeAttribute("hidden");
	form.querySelector('[type="email"]')?.removeAttribute("aria-invalid");
}

function cloneIcon(form, type) {
	const icons = form.querySelector("[data-newsletter-icons]");
	const source = icons?.querySelector(
		type === "success" ? "[data-icon-success]" : "[data-icon-error]",
	);
	return source ? source.cloneNode(true) : null;
}

function showFeedback(form, type, message) {
	const feedback = getFeedbackContainer(form);
	const isSuccess = type === "success";
	const tag = isSuccess ? "p" : "small";

	feedback.hidden = false;
	feedback.innerHTML = "";

	const messageEl = document.createElement(tag);
	messageEl.className = `newsletter-form__message form__message${
		isSuccess ? " newsletter-form__message--success" : ""
	}`;
	messageEl.setAttribute("role", isSuccess ? "status" : "alert");
	messageEl.id = `${form.id}-${type}`;

	const icon = cloneIcon(form, type);
	if (icon) messageEl.appendChild(icon);

	const text = document.createElement("span");
	text.textContent = message;
	messageEl.appendChild(text);

	feedback.appendChild(messageEl);

	if (isSuccess) {
		form.querySelector("[data-newsletter-fields]")?.setAttribute("hidden", "");
		localStorage.setItem(SUBSCRIBED_KEY, "true");
		messageEl.focus?.();
	}
}

function setFormLoading(form, isLoading) {
	const submitButton = form.querySelector('[type="submit"]');
	if (!submitButton) return;

	submitButton.disabled = isLoading;
	submitButton.setAttribute("aria-busy", isLoading ? "true" : "false");
}

function extractErrorMessage(doc, form) {
	const responseForm = doc.getElementById(form.id);
	const errorEl =
		responseForm?.querySelector(
			'.form__message:not(.newsletter-form__message--success)',
		) ||
		doc.querySelector('.form__message:not(.newsletter-form__message--success)');

	if (errorEl?.textContent?.trim()) {
		return errorEl.textContent.replace(/\s+/g, " ").trim();
	}

	const invalidInput =
		responseForm?.querySelector('.field__input[aria-invalid="true"]') ||
		doc.querySelector('.field__input[aria-invalid="true"]');

	if (invalidInput) {
		return (
			window.newsletterStrings?.error ||
			"Please enter a valid email address."
		);
	}

	return null;
}

function hasSuccessMessage(doc, form) {
	const responseForm = doc.getElementById(form.id);
	return Boolean(
		responseForm?.querySelector(".newsletter-form__message--success") ||
			doc.querySelector(".newsletter-form__message--success"),
	);
}

async function onNewsletterSubmit(event) {
	event.preventDefault();

	const form = event.currentTarget;
	const strings = window.newsletterStrings || {};
	const successMessage = strings.success || "Thanks for subscribing";
	const errorMessage = strings.error || "Something went wrong. Please try again.";

	clearFeedback(form);
	setFormLoading(form, true);

	const formData = new FormData(form);
	formData.set(
		"return_to",
		`${window.location.pathname}${window.location.search}`,
	);

	try {
		const response = await fetch(form.action, {
			method: "POST",
			body: formData,
			headers: {
				Accept: "text/html",
			},
		});

		const html = await response.text();
		const doc = new DOMParser().parseFromString(html, "text/html");
		const serverError = extractErrorMessage(doc, form);

		if (serverError) {
			showFeedback(form, "error", serverError);
			form.querySelector('[type="email"]')?.setAttribute("aria-invalid", "true");
			return;
		}

		if (response.redirected || hasSuccessMessage(doc, form)) {
			showFeedback(form, "success", successMessage);
			form.reset();
			return;
		}

		showFeedback(form, "error", errorMessage);
	} catch {
		showFeedback(form, "error", errorMessage);
	} finally {
		setFormLoading(form, false);
	}
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initNewsletterForms);
} else {
	initNewsletterForms();
}

document.addEventListener("shopify:section:load", initNewsletterForms);
