
/* =========================================
   SMARTPARK LOGIN CONFIGURATION
========================================= */

// LOGIN INFORMATION

const LOGIN_USER = "admin";
const LOGIN_PASS = "1234";

const OPEN_LINK = "index.html";


// =========================================
// BACKGROUND IMAGE SETTINGS
// =========================================

// নিজের images Folder-এর ছবির নাম লিখুন

const backgroundImages = [

    "image_01.jpg",

    "image_02.jpg",

    "image_03.jpg"

];

// Image change interval: 5 seconds

const CHANGE_INTERVAL = 3000;


// =========================================
// LOGIN ELEMENTS
// =========================================

const f = document.getElementById("f");
const u = document.getElementById("u");
const p = document.getElementById("p");
const msg = document.getElementById("msg");
const box = document.getElementById("box");


// =========================================
// MESSAGE FUNCTION
// =========================================

function showMsg(text, type) {

    msg.textContent = text;
    msg.className = "msg show " + type;

}


// =========================================
// SHOW / HIDE PASSWORD
// =========================================

document.getElementById("eye").addEventListener("click", function () {

    const hidden = p.type === "password";

    p.type = hidden ? "text" : "password";

    this.textContent = hidden ? "Hide" : "Show";

});


// =========================================
// LOGIN FUNCTION
// =========================================

f.addEventListener("submit", function (event) {

    event.preventDefault();

    if (
        u.value.trim() === LOGIN_USER &&
        p.value === LOGIN_PASS
    ) {

        showMsg("Login successful. Opening...", "ok");

        setTimeout(function () {

            window.location.href = OPEN_LINK;

        }, 600);

    } else {

        showMsg("Wrong User Name or Password. Again!", "err");

        p.value = "";

        p.focus();

        box.classList.remove("shake");

        void box.offsetWidth;

        box.classList.add("shake");

    }

});


// =========================================
// BACKGROUND SLIDESHOW
// =========================================

const bg1 = document.getElementById("bg1");
const bg2 = document.getElementById("bg2");

const layers = [bg1, bg2];

let currentImage = 0;
let activeLayer = 0;


// Load first image

function loadFirstImage() {

    bg1.src = backgroundImages[0];

}


// Preload all images

backgroundImages.forEach(function (src) {

    const img = new Image();

    img.src = src;

});


// Change background

function changeBackground() {

    const nextImage =
        (currentImage + 1) % backgroundImages.length;

    const nextLayerIndex =
        activeLayer === 0 ? 1 : 0;

    const nextLayer = layers[nextLayerIndex];

    const previousLayer = layers[activeLayer];

    const image = new Image();

    image.onload = function () {

        nextLayer.src = image.src;

        nextLayer.classList.add("active");

        previousLayer.classList.remove("active");

        activeLayer = nextLayerIndex;

        currentImage = nextImage;

    };

    image.onerror = function () {

        console.error(
            "Image not found: " + backgroundImages[nextImage]
        );

    };

    image.src = backgroundImages[nextImage];

}


// Start slideshow

if (backgroundImages.length > 0) {

    loadFirstImage();

    if (backgroundImages.length > 1) {

        setInterval(
            changeBackground,
            CHANGE_INTERVAL
        );

    }

}
