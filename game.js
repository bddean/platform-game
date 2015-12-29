/*********** to do list  ***********/
/* TODO: clean up collision logic
 *   - Make it easier to separate collision callbacks from the state
 *   - If maps get big enough, use a heap instead of a list to hold bodies
 * TODO: more features
 *   - moving coins (enemies)
 *   - blocks that change color
 *   - visual level editor
 */

/*********** utility functions ***********/
 // from http://stackoverflow.com/questions/21363064/chrome-chromium-doesnt-know-javascript-function-math-sign
function sign(x) {
    if (+x === x) { // check if a number was given
        return (x === 0) ? x : (x > 0) ? 1 : -1;
    }
    return NaN;
}

/********** constants and global vars **********/
var BODIES;
var WIDTH = 640;
var HEIGHT = 480;
var DELAY = 10;
var canvas = document.getElementById('game');
var ctx = canvas.getContext('2d');

var INITIAL_CAMERA_HEIGHT = 0.1;
var NORMAL_CAMERA_HEIGHT = 0.4; // Scale objects

var camera = {};
var maxScore;
var currentLevel;

var xBounds;
var yBounds;

/********** objects in the game world ***********/
var nextTypeId = 1;
var types = {};

/**
 * Simple function to extend "classes" of objects.
 *
 * @param {function} Parent 
 * @param {string: *} paramSpec Properties set by passing a key-value map to the
 *     constructor, mapped to default values.
 * @param {string: *} initialProps Properties set in constructor, mapped to
 *     initial values.
 * @return {function(spec:{string:*})} A constructor for a object extending
 *     Parent which takes as its only argument a map to override default values
 *     in paramSpec
 */
function extend(Parent, paramSpec, initialProps) {
  var Constructor = function(spec) {
    spec = spec || {};
    Parent.apply(this, arguments);
    var key;
    for (key in paramSpec) this[key] = spec[key] || paramSpec[key];
    for (key in initialProps) this[key] = initialProps[key];
  };
  var id = nextTypeId++;
  Constructor.id = id;
  types[id] = Constructor;
  Constructor.prototype = new Parent();
  return Constructor;
}

var Body = extend(Object, {
  width: 50, 
  height: 75,
  left: 0, 
  top: 0,
  color: 'grey',
  vx: 0, 
  vy: 0,
  friction: 0
}, {
  collisionCallbacks: {}
});
Body.prototype.register = function() {
  BODIES.push(this);
  this.init();
  return this;
};
Body.prototype.pos = function() {
  if (arguments.length === 0) {
    return [this.left, this.top];
  } else if (arguments.length == 1) {
    this.left = arguments[0][0];
    this.top = arguments[0][1];
    return this;
  } else {
    this.left = arguments[0];
    this.top = arguments[1];
    return this;
  }
};
Body.prototype.destroy = function() {
  var index = BODIES.indexOf(this);
  BODIES.splice(index, 1);
};
Body.prototype.bottom = function() { return this.top + this.height; };
Body.prototype.right = function() { return this.left + this.width; };
Body.prototype.centerx = function() { return this.left + this.width / 2; };
Body.prototype.centery = function() { return this.top + this.height / 2; };
Body.prototype.draw = function() {
  ctx.fillStyle = this.color;
  ctx.fillRect((this.left - camera.x) * camera.z + WIDTH / 2,
               (this.top - camera.y) * camera.z + HEIGHT / 2,
               this.width * camera.z,
               this.height * camera.z);
};
Body.prototype.angleTo = function(other) {
  if (other.centerx() == this.centerx())
    return other.centery() > this.centery() ? 0.5 * Math.PI : 1.5 * Math.PI;
  else if (other.centery() == this.centery()) // not sure this check is needed
    return other.centerx() > this.centerx() ? 0 : Math.PI;
  return Math.atan((other.centery() - this.centery()) /
                   (other.centerx() - this.centerx()));
};
Body.prototype.collision = function(other) {
  // Alogorithm adapted from http://gamedev.stackexchange.com/questions/29786/a-simple-2d-rectangle-collision-algorithm-that-also-determines-which-sides-that
  // Compute Minkowski sum of both rectangles
  var w = (this.width + other.width) / 2;
  var h = (this.height + other.height) / 2;
  var dx = this.centerx() - other.centerx();
  var dy = this.centery() - other.centery();
  if (Math.abs(dx) <= w && Math.abs(dy) <= h) {
    var wy = w * dy;
    var hx = h * dx;
    return (wy > hx) ?
      ((wy > -hx) ? 'top' : 'right') :
      ((wy > -hx) ? 'left' : 'bottom');
  }
  return false;
};
Body.prototype.onCollisionWith = function(type, callback) {
  // TODO register callback in prototype not instance
  /*
   * Callback to be called on a collision, passed (direction, other)
   */
  this.collisionCallbacks[type.id] = callback;
};
Body.prototype.init = function() {
  // default - do nothing
};
Body.prototype.update = function() {
  // default - do nothing
};
Body.prototype.doCollisions = function() {
  for (var b in BODIES) {
    var collisionDirection = this.collision(BODIES[b]);
    if (collisionDirection) {
      

      for (var typeId in this.collisionCallbacks) {
        if (BODIES[b] != this && BODIES[b] instanceof types[typeId]) {
          this.collisionCallbacks[typeId].call(this, collisionDirection, BODIES[b]);
        }
      }
    }
  }
};

var Block = extend(Body);

var Coin = extend(Body, {
  width: 25,
  height: 25
});

var Moveable = extend(Block, {
  terminalXVelocity: 3,
  terminalYVelocity: 5,
  bouncy: false
}, {
  support: null,
  originalPos: [0, 0],
  accelx: 0,
  accely: 0,
  dirx: 0                       // Direction of horizontal movement
});
Moveable.prototype.velocity = function(x, y) {
  if (x === undefined) return [this.vx, this.vy];

  this.vx = x;
  this.vy = y;
  return this;
};
Moveable.prototype.jump = function(amount) {
 if (this.support)
     this.vy = -amount + this.support.vy;
};
Moveable.prototype.update = function(elapsedTime) {
  this.left += this.vx * elapsedTime;
  this.top += this.vy * elapsedTime;

  // Clean up: get rid of objects that are out of bounds
  if (this.centerx() < xBounds[0] || this.centerx() > xBounds[1] ||
      this.centery() < yBounds[0] || this.centery() > yBounds[1]) {
    this.destroy();
  }

  this.vy += this.accely * elapsedTime;
  var accelx = this.dirx * ((this.surface ? this.surface.friction * this.friction * 30 : 0) +
        0.04);
  this.vx += accelx * elapsedTime;

  if (this.support && this.dirx === 0) {
    this.vx *= (1 - this.friction * this.support.friction);
    this.startedFalling = undefined;
  }

  this.vx = sign(this.vx) * Math.min(Math.abs(this.vx), this.terminalXVelocity);
  this.vy = sign(this.vy) * Math.min(Math.abs(this.vy), this.terminalYVelocity);

  this.support = null;
  // this.doCollisions(); // TODO restore this part after making collision logic
  // more generic
};
Moveable.prototype.setOriginalPos = function(x, y) {
  this.originalPos = [x, y];
  this.pos(this.originalPos);
  return this;
};

var Elevator = extend(Moveable, {
  friction: 0.1,
  accelmag: 0.5
});
Elevator.prototype.update = function(elapsedTime) {
  if (this.direction == undefined) this.direction = 1; // down
  var distance = this.top - this.originalPos[1];
  if (distance < 100) {
    this.accely = this.accelmag;
  } else // if (distance > -100)
  {
    this.accely = -this.accelmag;
  }

  Moveable.prototype.update.apply(this, arguments);
};

var Player = extend(Moveable, {
  width: 50,
  height: 50,
  color: 'white',
  friction: 0.1,
  accely: 0.05
});
Player.prototype.switchColor = function() {
  if (this.color === 'white')
    this.color = 'black';
  else {
    this.color = 'white';
  }
};
Player.prototype.destroy = function() {
  this.pos(this.originalPos);
  this.color = "white";
  this.vx = 0;
  this.vy = 0;
};
Player.prototype.update = function(time) {
  Moveable.prototype.update.call(this, time);
  this.doCollisions();
};
Player.prototype.collideBlock = function(dir, body) {
  if ((this.color === "white" && body.color === "black") ||
      (this.color === "black" && body.color === "white"))
    this.destroy();

  else if (dir == "bottom") {
    this.top = body.top - this.height;
    this.vy = 0;
    this.support = body;
  } else if (dir == "top") {
    this.vy = 0;
    this.top = body.bottom() + 1;
  } else if (dir == "right") {
    if (this.bouncy && !this.support) {
      this.vx = -4;
      this.vy = -2;
    } else {
      this.left = body.left - this.width;
      this.vx = Math.min(this.vx, 0);
    }
  } else if (dir == "left") {
    if (this.bouncy && !this.support) {
      this.vx = 4;
      this.vy = -2;
    } else {
      this.left = body.right();
      this.vx = Math.max(this.vx, 0);
    }
  }
};
Player.prototype.collideCoin = function(dir, coin) {
  if ((this.color === "white" && coin.color === "black") ||
      (this.color === "black" && coin.color === "white"))
    this.destroy();
  else {
    coin.destroy();
    score += 1;
  }
  if (score == maxScore && currentLevel.next) {
    currentLevel = currentLevel.next;
    drawMap(currentLevel.map, this);
  }
};

var clear = function() {
  ctx.fillStyle = 'rgb(0, 191, 250)';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
};

var key = 0;
var done = false;
var left_pressed = false;
var right_pressed = false;
var doKeyDown = function(k) {
  if (k.keyCode == 32) { // space: jump up, and jump off walls
    player.jump(4);
    player.bouncy = true;
  }
  else if (k.keyCode == 65) { // A
    player.dirx = -1;
    left_pressed = true;
  } else if (k.keyCode == 68) { // D
    player.dirx = 1;
    right_pressed = true;
  } else if (k.keyCode == 81) { // Q
    player.bouncy = true;
  }
};
var doKeyUp = function(k) {
  if (k.keyCode == 65) { // A
    player.dirx = 0;
    left_pressed = false;
    if (right_pressed) player.dirx = 1;
  } else if (k.keyCode == 68) { // D
    player.dirx = 0;
    right_pressed = false;
    if (left_pressed) player.dirx = -1;
  } else if (k.keyCode == 32) { // Q
    player.bouncy = false;
  } else if (k.keyCode == 69) { // E
    player.switchColor();
  }
};

/*
  Use 2D array of characters for level maps.
  - W, B, G = white, black and grey blocks
  - i, b, g = white, black and grey coins
  - @       = the player
  - e, v    = white and black elevators. Their trajectory depends on the current
              parameter.

  The parameter is a numerical value available to the map generator for simple
  inputs to map positions. These characters alter its value:

  - The digits 0-9 each set the parameter to their respective value
  - '*' sets it to a random number between 0 and 1
  - '!' sets it to a random number at each remaining cell (i.e. all cells to the
    right on the same row and all cells in subsequent rows)
*/
var level1 = {};
var level2 = {};
var level3 = {};
var level4 = {};
var level5 = {};
level1.map = [
  '     iiiii',
  '@',
  'WWWWWBBBBBWWWWW'
];
level1.next = level2;
level2.map = [
  '  iii           bbb           iii     ',
  '@',
  'WWWWWWW       BBBBBBB       BBBBBBB'
];
level2.next = level3;
level3.map = [
  '                       W',
  '                       W',
  '                       W   BBBGGGWWGGGBBGGGWWGGGBBB b B     B b B',
  '                       W   B                      B b B     B b B',
  '                       W   B                      B   B     B   B',
  '                       W   B                      B i B     B i B',
  '                       W   B                      B i B     B i B',
  '                           B                      B   B     B   B',
  '                           B                      B   B     B   B',
  '@  iii        WWWW   BBBBBBB                      B b B     B b B',
  '                                                  B b B     B b B',
  'WWWWWWWWW',
  '',

  '                                                   WWWWWWWWWWWWW'
];
level3.next = level4;
level4.map = [
  '      b',
  ' i         i',
  '@   *vvv       b     b  i  b  i  b',
  'WWWW     *eee         ',
  '             *vvv',
  '                   !eeevvveeevvveee' 

];

function drawMap(map, player) {
  BODIES = [];
  player.register();
  player.vx = 0;
  player.vy = 0;
  maxScore = 0;
  xBounds = [0, 0];
  yBounds = [0, 0];

  score = 0;
  camera = {
    x: 0,
    y: 0,
    z: INITIAL_CAMERA_HEIGHT
  };
  var blockParam = 1;  // Numerical parameter passed to some characters in level
                       // maps
  var chaosMode = false; // Randomize the parameter at each new block
  var elevator;
  for (var i in map) {
    level = map[i];
    for (var j in level) {
      if (chaosMode) blockParam = Math.random();

      character = level[j];
      x = j * Block.prototype.width;
      y = i * Block.prototype.height;
      xBounds[0] = Math.min(xBounds[0], x);
      xBounds[1] = Math.max(xBounds[1], x);
      yBounds[0] = Math.min(yBounds[0], y);
      yBounds[1] = Math.max(yBounds[1], y);

      if (character === ' ') continue; // empty space
      else if (['W', 'B', 'G'].indexOf(character) > -1) { // blocks
        var body = new Block({
          left: x,
          top: y,
          friction: 0.7,
          color: {'W': 'white', 'B': 'black', 'G': 'grey'}[character]
        }).register();
      } else if (character === '@') { // the player
        player.setOriginalPos(x, y);
      } else if ('0123456789'.indexOf(character) > -1) { // Set parameter
        blockParam = parseInt(character);
        chaosMode = false;
      } else if (character == '*') {
        blockParam = Math.random();
        chaosMode = false;
      } else if (character == '!') {
        chaosMode = true;
      } else if (character == 'v') {
        elevator = new Elevator({color: 'black', 
                                 accelmag: blockParam * 0.1});
        elevator.setOriginalPos(x, y);
        elevator.register();
      } else if (character == 'e') {
        elevator = new Elevator({color: 'white', 
                                 accelmag: blockParam * 0.1});
        elevator.setOriginalPos(x, y);
        elevator.register();
      } else if (['b', 'i', 'g'].indexOf(character) > -1) { // coins
        new Coin({
          left: x,
          top: y,
          color :{
            'b': 'black',
            'i': 'white',
            'g': 'grey'
          }[character]
        }).register();
        maxScore++;
      }
    }
    xBounds[0] -= 400;
    xBounds[1] += 400;
    yBounds[0] -= 400;
    yBounds[1] += 400;
  }
  camera.x = player.centerx();
  camera.y = player.centery();
}

