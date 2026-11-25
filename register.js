(function () {
    "use strict";

    const STORAGE_KEY = "skillswapRegistrations";
    const ACTIVE_EMAIL_KEY = "skillswapActiveEmail";
    const LOGGED_OUT_KEY = "skillswapLoggedOut";
    const MAX_IMAGE_SIZE = 1024 * 1024;
    const form = document.getElementById("registration-form");
    const errorMessage = document.getElementById("register-error");
    const successMessage = document.getElementById("register-success");
    const pictureInput = document.getElementById("profile-picture");
    const pictureImage = document.getElementById("picture-image");
    const picturePlaceholder = document.getElementById("picture-placeholder");
    const skillGroups = {
        teach: {
            input: document.getElementById("teach-input"),
            list: document.getElementById("teach-list"),
            error: document.getElementById("teach-error"),
            skills: []
        },
        learn: {
            input: document.getElementById("learn-input"),
            list: document.getElementById("learn-list"),
            error: document.getElementById("learn-error"),
            skills: []
        }
    };
    let profilePicture = "";
    let pictureReadRequest = 0;

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.hidden = false;
        successMessage.hidden = true;
    }

    function clearMessages() {
        errorMessage.textContent = "";
        errorMessage.hidden = true;
        successMessage.hidden = true;
    }

    function updateTextValidity(input, message) {
        input.setCustomValidity(input.value.trim() ? "" : message);
    }

    function updateSkillValidity(group, showFeedback) {
        const hasPendingText = group.input.value.trim().length > 0;
        let message = "";
        if (group.skills.length === 0) {
            message = "Add at least one skill.";
        } else if (hasPendingText) {
            message = "Press Enter or Add to include the skill you typed.";
        }
        group.input.setCustomValidity(message);
        group.error.textContent = showFeedback ? message : "";
    }

    function renderSkills(group, showFeedback) {
        group.list.replaceChildren();
        group.skills.forEach(function (skill, index) {
            const chip = document.createElement("span");
            chip.className = "skill-chip";

            const label = document.createElement("span");
            label.textContent = skill;

            const removeButton = document.createElement("button");
            removeButton.type = "button";
            removeButton.className = "skill-chip-remove";
            removeButton.setAttribute("aria-label", "Remove " + skill);
            removeButton.textContent = "×";
            removeButton.addEventListener("click", function () {
                group.skills.splice(index, 1);
                renderSkills(group, true);
            });

            chip.append(label, removeButton);
            group.list.appendChild(chip);
        });
        updateSkillValidity(group, showFeedback);
    }

    function addSkills(group) {
        const entries = group.input.value.split(",");
        entries.forEach(function (entry) {
            const skill = entry.trim().replace(/\s+/g, " ");
            if (skill && !group.skills.some(function (existing) {
                return existing.toLocaleLowerCase() === skill.toLocaleLowerCase();
            })) {
                group.skills.push(skill);
            }
        });
        group.input.value = "";
        renderSkills(group, true);
        group.input.focus();
    }

    Object.keys(skillGroups).forEach(function (key) {
        const group = skillGroups[key];
        group.input.addEventListener("keydown", function (event) {
            if (event.key === "Enter") {
                event.preventDefault();
                addSkills(group);
            }
        });
        group.input.addEventListener("input", function () {
            updateSkillValidity(group, true);
        });
        document.querySelector('[data-add-skill="' + key + '"]').addEventListener("click", function () {
            addSkills(group);
        });
        renderSkills(group);
    });

    const fullNameInput = document.getElementById("full-name");
    const collegeInput = document.getElementById("college");
    fullNameInput.addEventListener("input", function () {
        updateTextValidity(fullNameInput, "Enter your full name.");
    });
    collegeInput.addEventListener("input", function () {
        updateTextValidity(collegeInput, "Enter your college name.");
    });

    pictureInput.addEventListener("change", function () {
        clearMessages();
        pictureInput.setCustomValidity("");
        const readRequest = ++pictureReadRequest;
        const file = pictureInput.files && pictureInput.files[0];
        profilePicture = "";
        pictureImage.hidden = true;
        pictureImage.removeAttribute("src");
        picturePlaceholder.hidden = false;

        if (!file) {
            return;
        }

        if (!["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file.type)) {
            pictureInput.setCustomValidity("Choose a JPG, PNG, GIF or WebP image.");
            pictureInput.reportValidity();
            return;
        }

        if (file.size > MAX_IMAGE_SIZE) {
            pictureInput.setCustomValidity("Choose an image smaller than 1 MB.");
            pictureInput.reportValidity();
            return;
        }

        const reader = new FileReader();
        reader.addEventListener("load", function () {
            if (readRequest !== pictureReadRequest) {
                return;
            }
            if (typeof reader.result !== "string") {
                pictureInput.setCustomValidity("This image could not be read. Please choose another file.");
                showError("We couldn’t read that image. Please choose another profile picture.");
                return;
            }
            profilePicture = reader.result;
            pictureImage.src = profilePicture;
            pictureImage.hidden = false;
            picturePlaceholder.hidden = true;
        });
        reader.addEventListener("error", function () {
            if (readRequest !== pictureReadRequest) {
                return;
            }
            pictureInput.setCustomValidity("This image could not be read. Please choose another file.");
            showError("We couldn’t read that image. Please choose another profile picture.");
        });
        reader.readAsDataURL(file);
    });

    form.addEventListener("input", clearMessages);
    form.addEventListener("change", clearMessages);

    form.addEventListener("submit", function (event) {
        event.preventDefault();
        clearMessages();
        updateTextValidity(fullNameInput, "Enter your full name.");
        updateTextValidity(collegeInput, "Enter your college name.");
        Object.keys(skillGroups).forEach(function (key) {
            updateSkillValidity(skillGroups[key], true);
        });

        if (!form.reportValidity()) {
            return;
        }

        if (!profilePicture) {
            showError("Please wait for your profile picture to finish loading, then try again.");
            return;
        }

        const formData = new FormData(form);
        const email = String(formData.get("email")).trim().toLowerCase();
        let registrations;

        try {
            const storedData = localStorage.getItem(STORAGE_KEY);
            registrations = storedData === null ? [] : JSON.parse(storedData);
            if (!Array.isArray(registrations)) {
                throw new Error("The saved registration data is not a list.");
            }
        } catch (error) {
            showError("Saved registrations couldn’t be read from this browser. Please clear this site’s local storage and try again.");
            return;
        }

        const duplicate = registrations.some(function (registration) {
            return registration && typeof registration.email === "string" &&
                registration.email.trim().toLowerCase() === email;
        });
        if (duplicate) {
            showError("An account with this email is already registered on this device.");
            document.getElementById("email").focus();
            return;
        }

        const registration = {
            fullName: String(formData.get("fullName")).trim(),
            email: email,
            college: String(formData.get("college")).trim(),
            department: String(formData.get("department")),
            skillsToTeach: skillGroups.teach.skills.slice(),
            skillsToLearn: skillGroups.learn.skills.slice(),
            profilePicture: profilePicture,
            registeredAt: new Date().toISOString()
        };

        try {
            registrations.push(registration);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(registrations));
            localStorage.setItem(ACTIVE_EMAIL_KEY, email);
            localStorage.removeItem(LOGGED_OUT_KEY);
        } catch (error) {
            showError("Your profile couldn’t be saved. Your browser may be out of storage space.");
            return;
        }

        form.reset();
        Object.keys(skillGroups).forEach(function (key) {
            skillGroups[key].skills = [];
            renderSkills(skillGroups[key]);
        });
        pictureReadRequest += 1;
        profilePicture = "";
        pictureImage.hidden = true;
        pictureImage.removeAttribute("src");
        picturePlaceholder.hidden = false;
        successMessage.hidden = false;
        successMessage.scrollIntoView({ behavior: "smooth", block: "center" });
    });
})();
