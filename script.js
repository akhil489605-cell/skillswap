function joinNow() {
    window.location.href = "register.html";
}

function exploreSkills() {
    document.getElementById("skills").scrollIntoView({
        behavior: "smooth"
    });
}

(function () {
    "use strict";

    const PROFILE_STORAGE_KEY = "skillswapRegistrations";
    const ACTIVE_EMAIL_KEY = "skillswapActiveEmail";
    const LOGGED_OUT_KEY = "skillswapLoggedOut";
    const REQUEST_STORAGE_KEY = "skillswapExchangeRequests";
    const MIN_PROFILE_COUNT = 4;
    const categories = {
        "Programming": /\b(programming|coding|python|java|javascript|typescript|c\+\+|algorithm)\b/i,
        "Web Development": /\b(web|html|css|react|website|front[\s-]?end|back[\s-]?end)\b/i,
        "Designing": /\b(design|designer|figma|illustration|photoshop|canva|ui\/ux|ux|ui)\b/i,
        "Communication": /\b(communication|public speaking|presentation|writing|debate|language|english)\b/i,
        "Music": /\b(music|guitar|piano|singing|vocal|drums?|violin|music production)\b/i,
        "Photography": /\b(photography|photographer|photo|camera|portrait|lightroom)\b/i
    };
    const demoProfiles = [
        {
            fullName: "Kavya Rao",
            email: "kavya.demo@skillswap.example",
            college: "Northstar University",
            department: "Computer Science",
            skillsToTeach: ["JavaScript", "React"],
            skillsToLearn: ["UI/UX Design", "Photography"],
            isDemo: true
        },
        {
            fullName: "Noah Williams",
            email: "noah.demo@skillswap.example",
            college: "Westbridge College",
            department: "Design & Creative Arts",
            skillsToTeach: ["Figma", "Graphic Design"],
            skillsToLearn: ["Web Development", "Public Speaking"],
            isDemo: true
        },
        {
            fullName: "Mina Patel",
            email: "mina.demo@skillswap.example",
            college: "Lakeside Institute",
            department: "Media & Communication",
            skillsToTeach: ["Photography", "Video Editing"],
            skillsToLearn: ["Public Speaking", "Web Development"],
            isDemo: true
        },
        {
            fullName: "Leo Kim",
            email: "leo.demo@skillswap.example",
            college: "Riverdale University",
            department: "Performing Arts",
            skillsToTeach: ["Guitar", "Music Production"],
            skillsToLearn: ["Java Programming", "Photography"],
            isDemo: true
        }
    ];

    const searchInput = document.getElementById("explore-search");
    const sortSelect = document.getElementById("explore-sort");
    const cardGrid = document.getElementById("explore-students");
    const emptyState = document.getElementById("explore-empty");
    const emptyCopy = document.getElementById("explore-empty-copy");
    const resultCount = document.getElementById("explore-result-count");
    const statusMessage = document.getElementById("explore-status");
    const filterButtons = Array.prototype.slice.call(document.querySelectorAll("[data-skill-category]"));
    let activeCategory = "all";
    let currentStudent = null;
    let profiles = [];
    let exchangeRequests = [];

    function normalizeEmail(email) {
        return typeof email === "string" ? email.trim().toLowerCase() : "";
    }

    function normalizeSkills(skills) {
        return Array.isArray(skills) ? skills.filter(function (skill) {
            return typeof skill === "string" && skill.trim();
        }) : [];
    }

    function loadArray(key) {
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

    function setStatus(message, includeRegisterLink) {
        statusMessage.replaceChildren(document.createTextNode(message));
        if (includeRegisterLink) {
            const link = document.createElement("a");
            link.href = "register.html";
            link.textContent = " Create a profile";
            statusMessage.appendChild(link);
        }
        statusMessage.hidden = false;
    }

    function clearStatus() {
        statusMessage.replaceChildren();
        statusMessage.hidden = true;
    }

    function getStudentInitials(name) {
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

    function getProfileSkills(profile) {
        return normalizeSkills(profile.skillsToTeach).concat(normalizeSkills(profile.skillsToLearn));
    }

    function getCategories(profile) {
        const skillText = getProfileSkills(profile).join(" ");
        return Object.keys(categories).filter(function (category) {
            return categories[category].test(skillText);
        });
    }

    function getPrimarySkill(profile) {
        const skills = normalizeSkills(profile.skillsToTeach).concat(normalizeSkills(profile.skillsToLearn));
        return skills.length ? skills[0].toLocaleLowerCase() : "";
    }

    function addSkillList(container, skills, emptyText, className) {
        container.replaceChildren();
        if (!skills.length) {
            const empty = document.createElement("span");
            empty.className = "explore-card-no-skill";
            empty.textContent = emptyText;
            container.appendChild(empty);
            return;
        }
        skills.slice(0, 3).forEach(function (skill) {
            const chip = document.createElement("span");
            chip.className = className;
            chip.textContent = skill;
            container.appendChild(chip);
        });
        if (skills.length > 3) {
            const extra = document.createElement("span");
            extra.className = className + " explore-more-skills";
            extra.textContent = "+" + (skills.length - 3);
            container.appendChild(extra);
        }
    }

    function hasSentRequest(email) {
        return exchangeRequests.some(function (request) {
            return request && normalizeEmail(request.fromEmail) === normalizeEmail(currentStudent && currentStudent.email) &&
                normalizeEmail(request.toEmail) === email;
        });
    }

    function createSkillRow(label, skills, emptyText, kind) {
        const row = document.createElement("div");
        row.className = "explore-skill-row";
        const title = document.createElement("span");
        title.className = "explore-skill-label";
        title.textContent = label;
        const list = document.createElement("div");
        list.className = "explore-skill-tags";
        addSkillList(list, skills, emptyText, "explore-skill-tag " + kind);
        row.append(title, list);
        return row;
    }

    function sendRequest(profile, button) {
        if (!currentStudent) {
            setStatus("Create a student profile before sending an exchange request.", true);
            return;
        }
        const targetEmail = normalizeEmail(profile.email);
        if (!targetEmail || targetEmail === normalizeEmail(currentStudent.email)) {
            setStatus("This profile is not available for a new exchange request.");
            return;
        }

        button.disabled = true;
        button.textContent = "Sending...";
        try {
            const latestRequests = loadArray(REQUEST_STORAGE_KEY).filter(function (request) {
                return request && typeof request === "object";
            });
            const exists = latestRequests.some(function (request) {
                return normalizeEmail(request.fromEmail) === normalizeEmail(currentStudent.email) &&
                    normalizeEmail(request.toEmail) === targetEmail;
            });
            if (!exists) {
                latestRequests.push({
                    fromEmail: normalizeEmail(currentStudent.email),
                    toEmail: targetEmail,
                    status: "pending",
                    requestedAt: new Date().toISOString()
                });
                localStorage.setItem(REQUEST_STORAGE_KEY, JSON.stringify(latestRequests));
            }
            exchangeRequests = latestRequests;
            button.textContent = "Request sent";
            button.classList.add("request-sent");
            setStatus("Your exchange request was saved on this device.");
        } catch (error) {
            button.disabled = false;
            button.textContent = "Connect";
            setStatus("We couldn’t save this request in your browser. Please check local storage and try again.");
        }
    }

    function createStudentCard(profile) {
        const card = document.createElement("article");
        card.className = "explore-student-card" + (profile.isDemo ? " demo-profile" : "");

        const cover = document.createElement("div");
        cover.className = "explore-card-cover";
        const avatar = document.createElement("div");
        avatar.className = "explore-card-avatar";
        const initials = document.createElement("span");
        initials.textContent = getStudentInitials(profile.fullName);
        avatar.appendChild(initials);
        if (typeof profile.profilePicture === "string" && profile.profilePicture.indexOf("data:image/") === 0) {
            const image = document.createElement("img");
            image.src = profile.profilePicture;
            image.alt = "";
            initials.hidden = true;
            avatar.appendChild(image);
        }
        cover.appendChild(avatar);

        const profileLabel = document.createElement("span");
        profileLabel.className = "explore-profile-label";
        profileLabel.textContent = profile.isDemo ? "DEMO PROFILE" : "STUDENT PROFILE";
        cover.appendChild(profileLabel);
        card.appendChild(cover);

        const body = document.createElement("div");
        body.className = "explore-card-body";
        const heading = document.createElement("div");
        heading.className = "explore-card-heading";
        const name = document.createElement("h3");
        name.textContent = profile.fullName || "SkillSwap student";
        const college = document.createElement("p");
        college.className = "explore-card-college";
        college.textContent = profile.college || "College not provided";
        heading.append(name, college);
        body.appendChild(heading);

        const department = document.createElement("p");
        department.className = "explore-card-department";
        department.textContent = profile.department || "Department not provided";
        body.appendChild(department);
        body.append(
            createSkillRow("CAN TEACH", normalizeSkills(profile.skillsToTeach), "Open to sharing", "teach"),
            createSkillRow("WANTS TO LEARN", normalizeSkills(profile.skillsToLearn), "Always curious", "learn")
        );

        const connect = document.createElement("button");
        connect.type = "button";
        connect.className = "explore-connect-btn";
        connect.textContent = "Connect";
        const email = normalizeEmail(profile.email);
        if (hasSentRequest(email)) {
            connect.disabled = true;
            connect.textContent = "Request sent";
            connect.classList.add("request-sent");
        } else {
            connect.addEventListener("click", function () {
                sendRequest(profile, connect);
            });
        }
        body.appendChild(connect);
        card.appendChild(body);
        return card;
    }

    function matchesSearch(profile, query) {
        if (!query) {
            return true;
        }
        const searchableText = [profile.fullName]
            .concat(getProfileSkills(profile))
            .join(" ")
            .toLocaleLowerCase();
        return searchableText.includes(query);
    }

    function getFilteredProfiles() {
        const query = searchInput.value.trim().toLocaleLowerCase();
        const filtered = profiles.filter(function (profile) {
            const matchesCategory = activeCategory === "all" || getCategories(profile).includes(activeCategory);
            return matchesCategory && matchesSearch(profile, query);
        });
        const sortBy = sortSelect.value;
        filtered.sort(function (first, second) {
            if (sortBy.indexOf("name-") === 0) {
                const nameOrder = String(first.fullName || "").localeCompare(String(second.fullName || ""));
                return sortBy === "name-desc" ? -nameOrder : nameOrder;
            }
            const skillOrder = getPrimarySkill(first).localeCompare(getPrimarySkill(second));
            return sortBy === "skill-desc" ? -skillOrder : skillOrder;
        });
        return filtered;
    }

    function renderProfiles() {
        const filtered = getFilteredProfiles();
        cardGrid.replaceChildren();
        filtered.forEach(function (profile) {
            cardGrid.appendChild(createStudentCard(profile));
        });
        resultCount.textContent = "Showing " + filtered.length + (filtered.length === 1 ? " student" : " students");
        emptyState.hidden = filtered.length !== 0;
        if (filtered.length === 0) {
            emptyCopy.textContent = searchInput.value.trim() || activeCategory !== "all"
                ? "Try another search or choose a different category."
                : "There are no student profiles to show right now.";
        }
    }

    function resetExploreFilters() {
        searchInput.value = "";
        sortSelect.value = "name-asc";
        activeCategory = "all";
        filterButtons.forEach(function (button) {
            const selected = button.dataset.skillCategory === "all";
            button.classList.toggle("active", selected);
            button.setAttribute("aria-pressed", String(selected));
        });
        clearStatus();
        renderProfiles();
    }

    function loadProfiles() {
        let registrations = [];
        try {
            registrations = loadArray(PROFILE_STORAGE_KEY).filter(function (profile) {
                return profile && typeof profile === "object" && normalizeEmail(profile.email);
            });
        } catch (error) {
            setStatus("Saved student profiles couldn’t be read from local storage. Demo profiles are shown until the saved data can be checked.");
        }

        try {
            if (localStorage.getItem(LOGGED_OUT_KEY) !== "true") {
                const activeEmail = normalizeEmail(localStorage.getItem(ACTIVE_EMAIL_KEY));
                currentStudent = registrations.find(function (profile) {
                    return normalizeEmail(profile.email) === activeEmail;
                }) || registrations[registrations.length - 1] || null;
            }
        } catch (error) {
            setStatus("Your student session couldn’t be read from local storage. Create a profile to send an exchange request.", true);
        }

        profiles = registrations.filter(function (profile) {
            return !currentStudent || normalizeEmail(profile.email) !== normalizeEmail(currentStudent.email);
        }).map(function (profile) {
            return Object.assign({}, profile, { isDemo: false });
        });

        if (profiles.length < MIN_PROFILE_COUNT) {
            demoProfiles.some(function (profile) {
                if (profiles.length >= MIN_PROFILE_COUNT) {
                    return true;
                }
                if (!profiles.some(function (existing) {
                    return normalizeEmail(existing.email) === normalizeEmail(profile.email);
                })) {
                    profiles.push(profile);
                }
                return false;
            });
        }

        try {
            exchangeRequests = loadArray(REQUEST_STORAGE_KEY).filter(function (request) {
                return request && typeof request === "object";
            });
        } catch (error) {
            setStatus("Exchange requests couldn’t be read from local storage. Connect requests will be unavailable until the saved data is checked.");
        }
    }

    searchInput.addEventListener("input", function () {
        clearStatus();
        renderProfiles();
    });
    sortSelect.addEventListener("change", renderProfiles);
    filterButtons.forEach(function (button) {
        button.addEventListener("click", function () {
            activeCategory = button.dataset.skillCategory;
            filterButtons.forEach(function (filter) {
                const selected = filter === button;
                filter.classList.toggle("active", selected);
                filter.setAttribute("aria-pressed", String(selected));
            });
            clearStatus();
            renderProfiles();
        });
    });
    document.getElementById("explore-clear").addEventListener("click", resetExploreFilters);
    document.getElementById("explore-empty-reset").addEventListener("click", resetExploreFilters);

    loadProfiles();
    renderProfiles();
})();