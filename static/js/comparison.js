(() => {
  const cards = [...document.querySelectorAll(".visual-card")];
  const budgetButtons = [...document.querySelectorAll(".variant-button[data-budget]")];

  const setMissingState = (image) => {
    const side = image.closest(".visual-side");
    side?.classList.toggle("is-missing", !image.complete || image.naturalWidth === 0);
  };

  cards.forEach((card) => {
    const stage = card.querySelector(".visual-stage");
    const divider = card.querySelector(".visual-divider");
    const images = [...card.querySelectorAll(".visual-image")];

    images.forEach((image) => {
      image.addEventListener("load", () => setMissingState(image));
      image.addEventListener("error", () => setMissingState(image));
      setMissingState(image);
    });

    const setSplit = (value) => {
      const split = Math.min(96, Math.max(4, value));
      stage.style.setProperty("--split", `${split}%`);
      divider.setAttribute("aria-valuenow", String(Math.round(split)));
    };

    const setFromPointer = (event) => {
      const rect = stage.getBoundingClientRect();
      setSplit(((event.clientX - rect.left) / rect.width) * 100);
    };

    divider.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      divider.setPointerCapture(event.pointerId);
      setFromPointer(event);
    });
    divider.addEventListener("pointermove", (event) => {
      if (divider.hasPointerCapture(event.pointerId)) setFromPointer(event);
    });
    divider.addEventListener("keydown", (event) => {
      const current = Number(divider.getAttribute("aria-valuenow")) || 50;
      if (event.key === "ArrowLeft") setSplit(current - 2);
      if (event.key === "ArrowRight") setSplit(current + 2);
    });
  });

  const selectBudget = (budget) => {
    cards.forEach((card) => {
      const scene = card.dataset.scene;
      const resultImage = card.querySelector(".visual-result");
      const resultSide = resultImage.closest(".visual-side");
      const label = card.querySelector(".result-label");
      resultSide.classList.remove("is-missing");
      resultImage.hidden = false;
      resultImage.src = `static/video/${scene}_${budget}.webp`;
      resultImage.alt = `${card.querySelector("h3").textContent} ${budget === "1p5k" ? "1.5k" : "30k"} rotating mesh`;
      label.textContent = budget === "1p5k" ? "Ours · 1.5k" : "Ours · 30k";
    });
    budgetButtons.forEach((button) => button.classList.toggle("is-active", button.dataset.budget === budget));
  };

  budgetButtons.forEach((button) => button.addEventListener("click", () => selectBudget(button.dataset.budget)));
})();
