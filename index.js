const socket = io();

// Constants
const width = 640;
const height = 960;
const fruitSizes = [
	{ radius: 24, img: './assets/img/circle0.png' },
	{ radius: 32, img: './assets/img/circle1.png' },
	{ radius: 40, img: './assets/img/circle2.png' },
	{ radius: 56, img: './assets/img/circle3.png' },
	{ radius: 64, img: './assets/img/circle4.png' },
	{ radius: 72, img: './assets/img/circle5.png' },
	{ radius: 84, img: './assets/img/circle6.png' },
	{ radius: 96, img: './assets/img/circle7.png' },
	{ radius: 128, img: './assets/img/circle8.png' },
	{ radius: 160, img: './assets/img/circle9.png' },
	{ radius: 192, img: './assets/img/circle10.png' },
];

const canvas = document.getElementById('game-canvas');
const ctx = document.createElement('canvas').getContext('2d');
canvas.appendChild(ctx.canvas);

// Adjust canvas size
ctx.canvas.width = width;
ctx.canvas.height = height;

// Resize handling
const resizeCanvas = () => {
	const screenWidth = document.body.clientWidth;
	const screenHeight = document.body.clientHeight;

	let newWidth = width;
	let newHeight = height;
	let scaleUI = 1;

	if (screenWidth * 1.5 > screenHeight) {
		newHeight = Math.min(height, screenHeight);
		newWidth = newHeight / 1.5;
		scaleUI = newHeight / height;
	} else {
		newWidth = Math.min(width, screenWidth);
		newHeight = newWidth * 1.5;
		scaleUI = newWidth / width;
	}

	ctx.canvas.style.width = `${newWidth}px`;
	ctx.canvas.style.height = `${newHeight}px`;

	const ui = document.getElementById('game-ui');
	ui.style.width = `${width}px`;
	ui.style.height = `${height}px`;
	ui.style.transform = `scale(${scaleUI})`;
};

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Input handling
let currentFruitSize = 0; // Keeping track locally for UI, ideally should sync with server

canvas.addEventListener('mouseup', (e) => {
	const rect = ctx.canvas.getBoundingClientRect();
	const scaleX = ctx.canvas.width / rect.width;
	const x = (e.clientX - rect.left) * scaleX;

	socket.emit('drop', { x: x, sizeIndex: currentFruitSize });

	// Randomize next fruit size locally for now
	currentFruitSize = Math.floor(Math.random() * 5);
	document.getElementById('game-next-fruit').src = `./assets/img/circle${currentFruitSize}.png`;
});

// Image Preloading
const images = {};
fruitSizes.forEach((size, index) => {
	images[index] = new Image();
	images[index].src = size.img;
});
const wallImg = new Image(); // Optional: wall texture if needed

// Render Loop
socket.on('update', (bodies) => {
	ctx.clearRect(0, 0, width, height);

	// Draw background
	ctx.fillStyle = '#ffdcae';
	ctx.fillRect(0, 0, width, height);

	// Draw walls
	ctx.fillStyle = '#FFEEDB';
	// Floor
	ctx.fillRect(0, height - 64, width, 64);
	// Left
	ctx.fillRect(0, 0, 32, height);
	// Right
	ctx.fillRect(width - 32, 0, 32, height);

	bodies.forEach(body => {
		if (body.label === 'fruit') {
			const radius = fruitSizes[body.sizeIndex].radius;
			const img = images[body.sizeIndex];

			ctx.save();
			ctx.translate(body.x, body.y);
			ctx.rotate(body.angle);
			if (img.complete) {
				ctx.drawImage(img, -radius, -radius, radius * 2, radius * 2);
			} else {
				ctx.beginPath();
				ctx.arc(0, 0, radius, 0, Math.PI * 2);
				ctx.fillStyle = 'red';
				ctx.fill();
			}
			ctx.restore();
		}
	});
});
