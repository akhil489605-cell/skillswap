(function () {
    "use strict";

    const PROFILE_STORAGE_KEY = "skillswapRegistrations";
    const REQUEST_STORAGE_KEY = "skillswapExchangeRequests";
    const ACTIVE_EMAIL_KEY = "skillswapActiveEmail";
    const LOGGED_OUT_KEY = "skillswapLoggedOut";
    const requestList = document.getElementById("request-list");
    const emptyState = document.getElementById("requests-empty");
    const emptyTitle = document.getElementById("requests-empty-title");
    const emptyCopy = document.getElementById("requests-empty-copy");
    const emptyAction = document.getElementById("requests-empty-action");
    const overview = document.querySelector(".request-overview");
    const management = document.querySelector(".request-management");
    const userChip = document.getElementById("requests-user-chip");
    const alertBox = document.getElementById("requests-alert");
    const notice = document.getElementById("requests-notice");
    const showing = document.getElementById("request-showing");
    const filterButtons = Array.prototype.slice.call(document.querySelectorAll("[data-request-filter]"));
    let activeEmail = "";
    let currentStudent = null;
    let registrations = [];
    let requests = [];
    let activeFilter = "all";

    function normalizeEmail(email) {
        return typeof email === "string" ? email.trim().toLowerCase() : "";
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

    function normalizeStatus(status) {
        const normalized = typeof status === "string" ? status.toLowerCase() : "";
        return ["pending", "accepted", "rejected"].includes(normalized) ? normalized : "pending";
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

    function getSkills(profile, key) {
        return Array.isArray(profile[key]) ? profile[key].filter(function (skill) {
            return typeof skill === "string" && skill.trim();
        }) : [];
    }

    function setEmptyState(title, message, actionText, actionHref) {
        emptyTitle.textContent = title;
        emptyCopy.textContent = message;
        emptyAction.textContent = actionText;
        emptyAction.href = actionHref;
        emptyState.hidden = false;
        requestList.hidden = true;
    }

    function formatDate(dateString) {
        if (!dateString) {
            return "Recently";
        }
        const date = new Date(dateString);
        if (Number.isNaN(date.getTime())) {
            return "Recently";
        }
        return date.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric"
        });
    }

    function appendSkillRow(card, label, skills, kind, fallbackText) {
        const row = document.createElement("div");
        row.className = "request-skill-row";
        const heading = document.createElement("span");
        heading.className = "request-skill-label";
        heading.textContent = label;
        const skillList = document.createElement("div");
        skillList.className = "request-skill-list";
        if (skills.length === 0) {
            const fallback = document.createElement("span");
            fallback.className = "request-skill-empty";
            fallback.textContent = fallbackText;
            skillList.appendChild(fallback);
        } else {
            skills.slice(0, 4).forEach(function (skill) {
                const chip = document.createElement("span");
                chip.className = "request-skill-chip " + kind;
                chip.textContent = skill;
                skillList.appendChild(chip);
            });
        }
        row.append(heading, skillList);
        card.appendChild(row);
    }

    function createRequestCard(entry) {
        const request = entry.request;
        const student = entry.student;
        const status = normalizeStatus(request.status);
        const card = document.createElement("article");
        card.className = "exchange-request-card";

        const cardHeader = document.createElement("div");
        cardHeader.className = "exchange-request-header";
        const identity = document.createElement("div");
        identity.className = "request-student-identity";
        const avatar = document.createElement("div");
        avatar.className = "request-student-avatar";
        avatar.textContent = getInitials(student.fullName);
        if (typeof student.profilePicture === "string" && student.profilePicture.indexOf("data:image/") === 0) {
            const image = document.createElement("img");
            image.src = student.profilePicture;
            image.alt = "";
            avatar.textContent = "";
            avatar.appendChild(image);
        }
        const studentDetails = document.createElement("div");
        const name = document.createElement("h2");
        name.textContent = student.fullName || "SkillSwap student";
        const college = document.createElement("p");
        college.className = "request-student-college";
        college.textContent = student.college || "College not provided";
        studentDetails.append(name, college);
        identity.append(avatar, studentDetails);

        const statusBadge = document.createElement("span");
        statusBadge.className = "request-status-badge " + status;
        statusBadge.textContent = status.charAt(0).toUpperCase() + status.slice(1);
        cardHeader.append(identity, statusBadge);
        card.appendChild(cardHeader);

        const metadata = document.createElement("div");
        metadata.className = "request-metadata";
        const department = document.createElement("span");
        department.className = "request-department";
        department.textContent = student.department || "Department not provided";
        const date = document.createElement("span");
        date.className = "request-date";
        date.textContent = "Requested " + formatDate(request.requestedAt);
        metadata.append(department, date);
        card.appendChild(metadata);

        const skills = document.createElement("div");
        skills.className = "request-skill-exchange";
        appendSkillRow(skills, "CAN TEACH", getSkills(student, "skillsToTeach"), "teach", "Not listed");
        const exchangeIcon = document.createElement("span");
        exchangeIcon.className = "request-exchange-icon";
        exchangeIcon.setAttribute("aria-hidden", "true");
        exchangeIcon.textContent = "↔";
        skills.appendChild(exchangeIcon);
        appendSkillRow(skills, "WANTS TO LEARN", getSkills(student, "skillsToLearn"), "learn", "Not listed");
        card.appendChild(skills);

        if (status === "pending") {
            const actions = document.createElement("div");
            actions.className = "request-actions";
            const acceptButton = document.createElement("button");
            acceptButton.type = "button";
            acceptButton.className = "request-action-btn accept-request";
            acceptButton.textContent = "Accept request";
            acceptButton.addEventListener("click", function () {
                updateRequestStatus(entry.index, "accepted");
            });
            const rejectButton = document.createElement("button");
            rejectButton.type = "button";
            rejectButton.className = "request-action-btn reject-request";
            rejectButton.textContent = "Reject";
            rejectButton.addEventListener("click", function () {
                updateRequestStatus(entry.index, "rejected");
            });
            actions.append(acceptButton, rejectButton);
            card.appendChild(actions);
        } else {
            const response = document.createElement("p");
            response.className = "request-response-note " + status;
            response.textContent = status === "accepted"
                ? "You accepted this exchange request."
                : "You declined this exchange request.";
            card.appendChild(response);
        }
        return card;
    }

    function getReceivedRequests() {
        return requests.map(function (request, index) {
            const senderEmail = normalizeEmail(request && request.fromEmail);
            const student = registrations.find(function (profile) {
                return normalizeEmail(profile.email) === senderEmail;
            });
            return {
                request: request,
                index: index,
                student: student || {
                    fullName: "SkillSwap student",
                    college: "Student community",
                    department: "SkillSwap member",
                    skillsToTeach: [],
                    skillsToLearn: []
                }
            };
        }).filter(function (entry) {
            return entry.request &&
                normalizeEmail(entry.request.toEmail) === activeEmail &&
                normalizeEmail(entry.request.fromEmail) !== activeEmail;
        });
    }

    function renderRequests() {
        const received = getReceivedRequests();
        const counts = {
            all: received.length,
            pending: received.filter(function (entry) { return normalizeStatus(entry.request.status) === "pending"; }).length,
            accepted: received.filter(function (entry) { return normalizeStatus(entry.request.status) === "accepted"; }).length,
            rejected: received.filter(function (entry) { return normalizeStatus(entry.request.status) === "rejected"; }).length
        };
        document.getElementById("request-overview-count").textContent = String(counts.all);
        document.getElementById("request-count-all").textContent = String(counts.all);
        document.getElementById("request-count-pending").textContent = String(counts.pending);
        document.getElementById("request-count-accepted").textContent = String(counts.accepted);
        document.getElementById("request-count-rejected").textContent = String(counts.rejected);

        const filtered = activeFilter === "all" ? received : received.filter(function (entry) {
            return normalizeStatus(entry.request.status) === activeFilter;
        });
        requestList.replaceChildren();
        filtered.forEach(function (entry) {
            requestList.appendChild(createRequestCard(entry));
        });

        if (received.length === 0) {
            showing.textContent = "";
            setEmptyState("You’re all caught up.", "When someone wants to swap skills with you, their request will show up here.", "Explore skills", "index.html#skills");
            return;
        }

        if (filtered.length === 0) {
            showing.textContent = "No " + activeFilter + " requests";
            setEmptyState("No " + activeFilter + " requests.", "Requests with this status will appear here when you have them.", "View all requests", "requests.html");
            return;
        }

        emptyState.hidden = true;
        requestList.hidden = false;
        showing.textContent = "Showing " + filtered.length + (filtered.length === 1 ? " request" : " requests");
    }

    function updateRequestStatus(index, status) {
        try {
            const latestRequests = readArray(REQUEST_STORAGE_KEY);
            const request = latestRequests[index];
            if (!request ||
                normalizeEmail(request.toEmail) !== activeEmail ||
                normalizeStatus(request.status) !== "pending") {
                throw new Error("This request is no longer pending.");
            }

            request.status = status;
            request.respondedAt = new Date().toISOString();
            localStorage.setItem(REQUEST_STORAGE_KEY, JSON.stringify(latestRequests));
            requests = latestRequests;
            alertBox.hidden = true;
            notice.textContent = status === "accepted"
                ? "Request accepted. You’re ready to plan a skill exchange!"
                : "Request rejected. The request status has been updated.";
            notice.hidden = false;
            renderRequests();
        } catch (error) {
            alertBox.textContent = "We couldn’t update this request. It may have already been changed, or browser storage may be unavailable.";
            alertBox.hidden = false;
        }
    }

    filterButtons.forEach(function (button) {
        button.addEventListener("click", function () {
            activeFilter = button.dataset.requestFilter;
            filterButtons.forEach(function (filter) {
                const selected = filter === button;
                filter.classList.toggle("active", selected);
                filter.setAttribute("aria-pressed", String(selected));
            });
            notice.hidden = true;
            renderRequests();
        });
    });

    document.getElementById("requests-logout").addEventListener("click", function () {
        try {
            localStorage.setItem(LOGGED_OUT_KEY, "true");
            localStorage.removeItem(ACTIVE_EMAIL_KEY);
            window.location.href = "index.html";
        } catch (error) {
            alertBox.textContent = "We couldn’t end this session in your browser. Please try again.";
            alertBox.hidden = false;
        }
    });

    try {
        registrations = readArray(PROFILE_STORAGE_KEY).filter(function (profile) {
            return profile && typeof profile === "object";
        });
        requests = readArray(REQUEST_STORAGE_KEY);

        const loggedOut = localStorage.getItem(LOGGED_OUT_KEY) === "true";
        const storedEmail = normalizeEmail(localStorage.getItem(ACTIVE_EMAIL_KEY));
        currentStudent = !loggedOut && registrations.find(function (profile) {
            return normalizeEmail(profile.email) === storedEmail;
        });
        if (!loggedOut && !currentStudent && registrations.length > 0) {
            currentStudent = registrations[registrations.length - 1];
        }

        if (!currentStudent || !normalizeEmail(currentStudent.email)) {
            overview.hidden = true;
            management.hidden = true;
            userChip.hidden = true;
            setEmptyState(
                loggedOut ? "You’re logged out." : "Create a profile to manage requests.",
                loggedOut
                    ? "Your saved profile is still on this device. Register again to start a new session."
                    : "Register as a student to receive and respond to skill exchange requests.",
                "Create a profile",
                "register.html"
            );
            return;
        }

        activeEmail = normalizeEmail(currentStudent.email);
        document.getElementById("requests-user-name").textContent = currentStudent.fullName || "student";
        userChip.hidden = false;
        renderRequests();
    } catch (error) {
        overview.hidden = true;
        management.hidden = true;
        alertBox.textContent = "Exchange requests couldn’t be loaded from this browser. Check the saved profile and request data, then try again.";
        alertBox.hidden = false;
    }
})();
