const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const Matter = require('matter-js');

app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// --- Game Logic (Ported from index.js) ---

const {
    Engine, Events, Composite, Bodies, Runner
} = Matter;

const engine = Engine.create();
const runner = Runner.create();

const Game = {
    width: 640,
    height: 960,
    fruitSizes: [
        { radius: 24, scoreValue: 1 },
        { radius: 32, scoreValue: 3 },
        { radius: 40, scoreValue: 6 },
        { radius: 56, scoreValue: 10 },
        { radius: 64, scoreValue: 15 },
        { radius: 72, scoreValue: 21 },
        { radius: 84, scoreValue: 28 },
        { radius: 96, scoreValue: 36 },
        { radius: 128, scoreValue: 45 },
        { radius: 160, scoreValue: 55 },
        { radius: 192, scoreValue: 66 },
    ],
    wallPad: 64,
    loseHeight: 84,
    friction: {
        friction: 0.006,
        frictionStatic: 0.006,
        frictionAir: 0,
        restitution: 0.1
    },
    init: function () {
        const wallProps = {
            isStatic: true,
            ...Game.friction,
            label: 'wall'
        };

        const ground = Bodies.rectangle(Game.width / 2, Game.height + (Game.wallPad / 2) - 48, Game.width, Game.wallPad, wallProps);
        const leftWall = Bodies.rectangle(-(Game.wallPad / 2), Game.height / 2, Game.wallPad, Game.height, wallProps);
        const rightWall = Bodies.rectangle(Game.width + (Game.wallPad / 2), Game.height / 2, Game.wallPad, Game.height, wallProps);

        Composite.add(engine.world, [ground, leftWall, rightWall]);

        Events.on(engine, 'collisionStart', function (e) {
            for (let i = 0; i < e.pairs.length; i++) {
                const { bodyA, bodyB } = e.pairs[i];

                if (bodyA.isStatic || bodyB.isStatic) continue;

                // Simple merge logic
                if (bodyA.sizeIndex === bodyB.sizeIndex && !bodyA.popped && !bodyB.popped) {
                    if (bodyA.sizeIndex < Game.fruitSizes.length - 1) {
                        bodyA.popped = true;
                        bodyB.popped = true;

                        const newSizeIndex = bodyA.sizeIndex + 1;
                        const midX = (bodyA.position.x + bodyB.position.x) / 2;
                        const midY = (bodyA.position.y + bodyB.position.y) / 2;

                        Composite.remove(engine.world, [bodyA, bodyB]);
                        Composite.add(engine.world, Game.createFruit(midX, midY, newSizeIndex));
                    }
                }
            }
        });



        // Start simulation
        // Runner.run(runner, engine); // Runner is not ideal for Node.js
    },
    createFruit: function (x, y, sizeIndex) {
        const radius = Game.fruitSizes[sizeIndex].radius;
        const fruit = Bodies.circle(x, y, radius, {
            ...Game.friction,
            label: 'fruit'
        });
        fruit.sizeIndex = sizeIndex;
        fruit.popped = false;
        return fruit;
    },
    reset: function () {
        Composite.clear(engine.world);
        Engine.clear(engine);
        Game.init();
    }
};

Game.init();

// --- Network Logic ---

io.on('connection', (socket) => {
    console.log('a user connected');

    socket.on('drop', (data) => {
        // Validation: clamp x
        let x = data.x;
        const r = Game.fruitSizes[data.sizeIndex].radius;
        if (x < r) x = r;
        if (x > Game.width - r) x = Game.width - r;

        const fruit = Game.createFruit(x, 32, data.sizeIndex); // 32 is previewBallHeight
        Composite.add(engine.world, fruit);
    });

    socket.on('disconnect', () => {
        console.log('user disconnected');
    });
});

// Game Loop (Physics + Broadcast)
setInterval(() => {
    Engine.update(engine, 1000 / 60);

    const bodies = Composite.allBodies(engine.world);

    // Check Game Over
    let gameOver = false;
    bodies.forEach(b => {
        if (b.label === 'fruit' && !b.isStatic && b.position.y < Game.loseHeight && b.velocity.y > -0.1 && b.velocity.y < 0.1) {
            gameOver = true;
        }
    });

    if (gameOver) {
        Game.reset();
    }

    const state = bodies.map(b => ({
        // ... mapped props
        id: b.id,
        x: b.position.x,
        y: b.position.y,
        angle: b.angle,
        sizeIndex: b.sizeIndex,
        label: b.label
    }));
    io.emit('update', state);
}, 1000 / 60);

server.listen(3001, () => {
    console.log('listening on *:3001');
});
