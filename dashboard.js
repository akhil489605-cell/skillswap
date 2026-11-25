(function () {
    "use strict";

    const STORAGE_KEY = "skillswapRegistrations";
    const ACTIVE_EMAIL_KEY = "skillswapActiveEmail";
    const LOGGED_OUT_KEY = "skillswapLoggedOut";
    const REQUESTS_KEY = "skillswapExchangeRequests";
    const content = document.getElementById("dashboard-content");
    const emptyState = document.getElementById("dashboard-empty");
    const alertBox = document.getElementById("dashboard-alert");
    const recommendationsContainer = document.getElementById("recommendations");
    let activeStudent = null;
    let exchangeRequests = [];

    function showAlert(message) {
        alertBox.textContent = message;
        alertBox.hidden = false;
    }

    function showEmptyState(title, message, actionText, actionHref) {
        document.getElementById("empty-title").textContent = title;
        document.getElementById("empty-copy").textContent = message;
        const action = document.getElementById("empty-action");
        action.textContent = actionText;
        action.href = actionHref;
        content.hidden = true;
        emptyState.hidden = false;
    }

    function readArray(key) {
        const saved = localStorage.getItem(key);
        if (saved === null) {
            return [];
        }
        const parsed = JSON.parse(saved);
        if (!Array.isArray(parsed)) {
            throw new Error("Saved data is not a list.");
        }
        return parsed;
    }

    function normalizeEmail(email) {
        return typeof email === "string" ? email.trim().toLowerCase() : "";
    }

    function normalizeSkills(skills) {
        if (!Array.isArray(skills)) {
            return [];
        }
        return skills.filter(function (skill) {
            return typeof skill === "string" && skill.trim();
        });
    }

    function getInitials(name) {
        return String(name || "Student")
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map(function (part) {
                return part.charAt(0).toUpperCase();
            })
            .join("");
    }

    function addSkillChips(container, skills, emptyText, kind) {
        container.replaceChildren();
        if (skills.length === 0) {
            const empty = document.createElement("span");
            empty.className = "dashboard-skills-empty";
            empty.textContent = emptyText;
            container.appendChild(empty);
            return;
        }
        skills.forEach(function (skill) {
            const chip = document.createElement("span");
            chip.className = "dashboard-skill-chip " + kind;
            chip.textContent = skill;
            container.appendChild(chip);
        });
    }

    function getMatch(current, candidate) {
        const currentTeach = normalizeSkills(current.skillsToTeach);
        const currentLearn = normalizeSkills(current.skillsToLearn);
        const candidateTeach = normalizeSkills(candidate.skillsToTeach);
        const candidateLearn = normalizeSkills(candidate.skillsToLearn);
        const currentTeachSet = currentTeach.map(function (skill) { return skill.toLowerCase(); });
        const currentLearnSet = currentLearn.map(function (skill) { return skill.toLowerCase(); });
        const candidateTeachSet = candidateTeach.map(function (skill) { return skill.toLowerCase(); });
        const candidateLearnSet = candidateLearn.map(function (skill) { return skill.toLowerCase(); });
        const matchingLearn = currentLearn.filter(function (skill) {
            return candidateTeachSet.includes(skill.toLowerCase());
        });
        const matchingTeach = currentTeach.filter(function (skill) {
            return candidateLearnSet.includes(skill.toLowerCase());
        });
        const sharedLearning = currentLearn.filter(function (skill) {
            return candidateLearnSet.includes(skill.toLowerCase());
        });
        return {
            score: matchingLearn.length + matchingTeach.length,
            labels: matchingLearn.concat(matchingTeach).filter(function (skill, index, list) {
                return list.findIndex(function (other) {
                    return other.toLowerCase() === skill.toLowerCase();
                }) === index;
            }),
            sharedLearning: sharedLearning
        };
    }

    function makeProfileImage(profile, initials, className) {
        const wrapper = document.createElement("div");
        wrapper.className = className;

        const fallback = document.createElement("span");
        fallback.className = "profile-initials";
        fallback.textContent = initials;
        wrapper.appendChild(fallback);

        if (typeof profile.profilePicture === "string" && profile.profilePicture.indexOf("data:image/") === 0) {
            const image = document.createElement("img");
            image.src = profile.profilePicture;
            image.alt = "";
            fallback.hidden = true;
            wrapper.appendChild(image);
        }
        return wrapper;
    }

    function createTagList(skills, className, fallbackText) {
        const list = document.createElement("div");
        list.className = className;
        const displayedSkills = skills.slice(0, 3);
        if (displayedSkills.length === 0) {
            const fallback = document.createElement("span");
            fallback.className = "recommendation-no-skills";
            fallback.textContent = fallbackText;
            list.appendChild(fallback);
            return list;
        }
        displayedSkills.forEach(function (skill) {
            const tag = document.createElement("span");
            tag.textContent = skill;
            list.appendChild(tag);
        });
        if (skills.length > displayedSkills.length) {
            const more = document.createElement("span");
            more.className = "recommendation-more";
            more.textContent = "+" + (skills.length - displayedSkills.length);
            list.appendChild(more);
        }
        return list;
    }

    function requestWasSent(candidateEmail) {
        return exchangeRequests.some(function (request) {
            return request && normalizeEmail(request.fromEmail) === normalizeEmail(activeStudent.email) &&
                normalizeEmail(request.toEmail) === candidateEmail;
        });
    }

    function updateRequestCount() {
        const count = exchangeRequests.filter(function (request) {
            return request && normalizeEmail(request.fromEmail) === normalizeEmail(activeStudent.email);
        }).length;
        document.getElementById("request-count").textContent = String(count);
    }

    function sendExchangeRequest(candidate, button) {
        button.disabled = true;
        button.textContent = "Sending…";

        try {
            const latestRequests = readArray(REQUESTS_KEY);
            const candidateEmail = normalizeEmail(candidate.email);
            const duplicate = latestRequests.some(function (request) {
                return request && normalizeEmail(request.fromEmail) === normalizeEmail(activeStudent.email) &&
                    normalizeEmail(request.toEmail) === candidateEmail;
            });
            if (duplicate) {
                exchangeRequests = latestRequests;
                button.textContent = "Request sent";
                updateRequestCount();
                return;
            }

            latestRequests.push({
                fromEmail: normalizeEmail(activeStudent.email),
                toEmail: candidateEmail,
                status: "pending",
                requestedAt: new Date().toISOString()
            });
            localStorage.setItem(REQUESTS_KEY, JSON.stringify(latestRequests));
            exchangeRequests = latestRequests;
            button.textContent = "Request sent";
            button.classList.add("request-sent");
            showAlert("Your exchange request was saved on this device.");
            alertBox.classList.add("dashboard-notice");
            updateRequestCount();
        } catch (error) {
            button.disabled = false;
            button.textContent = "Request an exchange";
            showAlert("We couldn’t save your exchange request in this browser. Check local storage and try again.");
            alertBox.classList.remove("dashboard-notice");
        }
    }

    function createRecommendation(profile) {
        const email = normalizeEmail(profile.email);
        const initials = getInitials(profile.fullName);
        const match = getMatch(activeStudent, profile);
        const card = document.createElement("article");
        card.className = "recommendation-card";

        const cover = document.createElement("div");
        cover.className = "recommendation-cover";
        cover.appendChild(makeProfileImage(profile, initials, "recommendation-avatar"));
        const badge = document.createElement("span");
        badge.className = "recommendation-badge";
        badge.textContent = match.score > 0 ? "Great skill match" : "Community pick";
        cover.appendChild(badge);
        card.appendChild(cover);

        const details = document.createElement("div");
        details.className = "recommendation-details";
        const name = document.createElement("h3");
        name.textContent = profile.fullName || "SkillSwap student";
        const college = document.createElement("p");
        college.className = "recommendation-college";
        college.textContent = [profile.college, profile.department].filter(Boolean).join(" · ") || "Student community";
        details.append(name, college);

        if (match.labels.length > 0) {
            const matchLine = document.createElement("p");
            matchLine.className = "match-line";
            matchLine.textContent = "Could swap: " + match.labels.slice(0, 2).join(" · ");
            details.appendChild(matchLine);
        } else if (match.sharedLearning.length > 0) {
            const matchLine = document.createElement("p");
            matchLine.className = "match-line";
            matchLine.textContent = "Also curious about: " + match.sharedLearning.slice(0, 2).join(" · ");
            details.appendChild(matchLine);
        }

        const skillRows = document.createElement("div");
        skillRows.className = "recommendation-skill-rows";
        const teaches = document.createElement("div");
        teaches.className = "recommendation-skill-row";
        const teachLabel = document.createElement("span");
        teachLabel.textContent = "TEACHES";
        teaches.append(teachLabel, createTagList(normalizeSkills(profile.skillsToTeach), "recommendation-tags", "Open to sharing"));
        const learns = document.createElement("div");
        learns.className = "recommendation-skill-row";
        const learnLabel = document.createElement("span");
        learnLabel.textContent = "WANTS TO LEARN";
        learns.append(learnLabel, createTagList(normalizeSkills(profile.skillsToLearn), "recommendation-tags learn", "Always curious"));
        skillRows.append(teaches, learns);
        details.appendChild(skillRows);

        const requestButton = document.createElement("button");
        requestButton.type = "button";
        requestButton.className = "request-button";
        requestButton.textContent = "Request an exchange";
        if (requestWasSent(email)) {
            requestButton.textContent = "Request sent";
            requestButton.disabled = true;
            requestButton.classList.add("request-sent");
        } else if (!email || email === normalizeEmail(activeStudent.email)) {
            requestButton.textContent = "Unavailable";
            requestButton.disabled = true;
        } else {
            requestButton.addEventListener("click", function () {
                sendExchangeRequest(profile, requestButton);
            });
        }
        details.appendChild(requestButton);
        card.appendChild(details);
        return card;
    }

    function renderRecommendations(registrations) {
        const candidates = registrations.filter(function (profile) {
            return profile && normalizeEmail(profile.email) &&
                normalizeEmail(profile.email) !== normalizeEmail(activeStudent.email);
        });
        candidates.sort(function (first, second) {
            const firstMatch = getMatch(activeStudent, first);
            const secondMatch = getMatch(activeStudent, second);
            if (firstMatch.score !== secondMatch.score) {
                return secondMatch.score - firstMatch.score;
            }
            return String(first.fullName || "").localeCompare(String(second.fullName || ""));
        });

        recommendationsContainer.replaceChildren();
        candidates.slice(0, 3).forEach(function (profile) {
            recommendationsContainer.appendChild(createRecommendation(profile));
        });
        document.getElementById("recommendation-count").textContent = candidates.length
            ? candidates.length + (candidates.length === 1 ? " student" : " students")
            : "";
        document.getElementById("recommendation-empty").hidden = candidates.length > 0;
    }

    function renderDashboard(registrations) {
        const fullName = String(activeStudent.fullName || "SkillSwap student").trim();
        const initials = getInitials(fullName);
        document.getElementById("student-name").textContent = fullName;
        document.getElementById("student-college").textContent = activeStudent.college || "College not provided";
        document.getElementById("student-department").textContent = activeStudent.department || "Student";
        document.getElementById("student-initials").textContent = initials;

        const picture = document.getElementById("student-picture");
        if (typeof activeStudent.profilePicture === "string" && activeStudent.profilePicture.indexOf("data:image/") === 0) {
            picture.src = activeStudent.profilePicture;
            picture.hidden = false;
            document.getElementById("student-initials").hidden = true;
        } else {
            picture.hidden = true;
            picture.removeAttribute("src");
        }

        const teachSkills = normalizeSkills(activeStudent.skillsToTeach);
        const learnSkills = normalizeSkills(activeStudent.skillsToLearn);
        document.getElementById("teach-count").textContent = String(teachSkills.length);
        document.getElementById("learn-count").textContent = String(learnSkills.length);
        addSkillChips(document.getElementById("teach-skills"), teachSkills, "Add a skill you’d like to teach.", "teach");
        addSkillChips(document.getElementById("learn-skills"), learnSkills, "Add a skill you’d like to learn.", "learn");
        updateRequestCount();
        renderRecommendations(registrations);
        emptyState.hidden = true;
        content.hidden = false;
    }

    document.getElementById("logout-button").addEventListener("click", function () {
        try {
            localStorage.setItem(LOGGED_OUT_KEY, "true");
            localStorage.removeItem(ACTIVE_EMAIL_KEY);
            window.location.href = "index.html";
        } catch (error) {
            showAlert("We couldn’t end this session in your browser. Please try again.");
        }
    });

    try {
        const registrations = readArray(STORAGE_KEY).filter(function (profile) {
            return profile && typeof profile === "object";
        });
        if (registrations.length === 0) {
            showEmptyState("Your dashboard is waiting.", "Create a student profile to start sharing skills and find your first exchange.", "Create a profile", "register.html");
            return;
        }
        if (localStorage.getItem(LOGGED_OUT_KEY) === "true") {
            showEmptyState("You’re logged out.", "Your saved profile is still on this device. Register again to start a new session.", "Create a profile", "register.html");
            return;
        }

        const activeEmail = normalizeEmail(localStorage.getItem(ACTIVE_EMAIL_KEY));
        if (activeEmail) {
            activeStudent = registrations.find(function (profile) {
                return normalizeEmail(profile.email) === activeEmail;
            });
        }
        if (!activeStudent) {
            activeStudent = registrations[registrations.length - 1];
        }

        exchangeRequests = readArray(REQUESTS_KEY).filter(function (request) {
            return request && typeof request === "object";
        });
        renderDashboard(registrations);
    } catch (error) {
        content.hidden = true;
        emptyState.hidden = true;
        showAlert("We couldn’t load your SkillSwap data from this browser. Check that local storage is available and the saved data is valid.");
    }
})();
