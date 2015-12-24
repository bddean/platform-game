/*********** to do list  ***********/
/* TODO: clean up collision logic (necessary for Elevator)
 *   - I may only need to check for collisions between player and other things
 *   - separate intialization + logic better
 *   - Make it easier to separate collision callbacks from the state
 *   - If maps get big enough, use a heap instead of a list to hold bodies
 * TODO: more features
 *   - moving coins (enemies)
 *   - blocks that change color
 **/
/*********** utility functions ***********/
function sign(x) { // from http://stackoverflow.com/questions/21363064/chrome-chromium-doesnt-know-javascript-function-math-sign
    if (+x === x) { // check if a number was given
        return (x === 0) ? x : (x > 0) ? 1 : -1;
    }
    return NaN;
}

/************** constants etc **************/
var BODIES;
var WIDTH = 640;
var HEIGHT = 480;
var DELAY = 10;
var canvas = document.getElementById('game');
var ctx = canvas.getContext('2d');

var MAX_SCORE;
var CURRENT_LEVEL;

var X_BOUNDS;
var Y_BOUNDS;

function Body(width, height, color)  {
  this.name = 'Body';
  this.width = width;
  this.height = height;
  this.color = color;
  this.vx = 0;
  this.vy = 0;
  this._left = 0;

  this._top = 0;
  this.friction = 0;
  this.collisionCallbacks = {};
}
Body.prototype.register = function() {
  BODIES.push(this);
  this.init();
  return this;
};
Body.prototype.pos = function() {
  if (arguments.length === 0) {
    return [this._left, this._top];
  } else if (arguments.length == 1) {
    this._left = arguments[0][0];
    this._top = arguments[0][1];
    return this;
  } else {
    this._left = arguments[0];
    this._top = arguments[1];
    return this;
  }
};
Body.prototype.destroy = function() {
  var index = BODIES.indexOf(this);
  BODIES.splice(index, 1);
};

Body.prototype.top = function() { return this._top; };
Body.prototype.left = function() { return this._left; };
Body.prototype.bottom = function() { return this._top + this.height; };
Body.prototype.right = function() { return this._left + this.width; };
Body.prototype.centerx = function() { return this._left + this.width / 2; };
Body.prototype.centery = function() { return this._top + this.height / 2; };
Body.prototype.draw = function() {
  ctx.fillStyle = this.color;
  ctx.fillRect((this.left() - camera.x) * camera.z + WIDTH / 2,
               (this.top() - camera.y) * camera.z + HEIGHT / 2,
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
  /*
   * Callback to be called on a collision, passed (direction, other)
   */
  this.collisionCallbacks[type] = callback;
};

Body.prototype.init = function() {
  // default - do nothing
};
Body.prototype.update = function() {
  // default - do nothing
};
Body.prototype.doCollisions = function() {
  for (var type in this.collisionCallbacks) {
    var callback = this.collisionCallbacks[type];
    for (var b in BODIES) {
      if (BODIES[b] != this && BODIES[b].name == type) {
        var col = this.collision(BODIES[b]);
        if (col) {
          callback.call(this, col, BODIES[b]);
        }
      }
    }
  }
};

function Coin(color) {
  this.name = 'Coin';
  this.width = 25;
  this.height = 25;
  this.color = color;

  this.collisionCallbacks = {};
}
Coin.prototype = new Body(0, 0, 'black');

function Moveable(width, height, color) {
//  this.__proto__ =
  this.name = 'Moveable';
  this.width = width;
  this.height = height;
  this.color = color;

  this.terminalXVelocity = 3;
  this.terminalYVelocity = 5;

  this.support = null;
  this.bouncy = false;

  this.originalPos = [0, 0];

  this.accelx = 0;
  this.accely = 0;
  this.dirx = 0;
}
Moveable.prototype = new Body(0, 0, 'rgb(0,0,0)');

Moveable.prototype.velocity = function(x, y) {
  if (x === undefined) return [this.vx, this.vy];

  this.vx = x;
  this.vy = y;
  return this;
};
Moveable.prototype.jump = function(amount) {
 if (this.support)
    this.vy = -amount;
};
Moveable.prototype.update = function(elapsedTime) {
  this._left += this.vx * elapsedTime;
  this._top += this.vy * elapsedTime;

  // Clean up: get rid of objects that are out of bounds
  if (this.centerx() < X_BOUNDS[0] || this.centerx() > X_BOUNDS[1] ||
      this.centery() < Y_BOUNDS[0] || this.centery() > Y_BOUNDS[1]) {
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
  // this.doCollisions();
};
Moveable.prototype.setOriginalPos = function(x, y) {
  this.originalPos = [x, y];
  this.pos(this.originalPos);
  return this;
};

var Elevator = function(width, height, color, accelmag) {
  Moveable.apply(this, arguments);
  this.name = 'Body';
  this.friction = 0.1;
  this.accely = 0;
  this.accelmag = accelmag;
};
Elevator.prototype = new Moveable(0, 0, 'rgb(0,0,0)');
Elevator.prototype.init = function() {

  // this.vy = Math.random() * 100 - 10;
};
Elevator.prototype.update = function(elapsedTime) {
  if (this.direction == undefined) this.direction = 1; // down
  var distance = this._top - this.originalPos[1];
  if (distance < 100) {
    this.accely = this.accelmag;
  } else // if (distance > -100)
  {
    this.accely = -this.accelmag;
  }

  Moveable.prototype.update.apply(this, arguments);
};

Elevator.prototype.init = function() {
  
};

var Player = function(width, height, color) {
  Moveable.apply(this, arguments);
  this.name = 'Player';
  this.originalPos = [0, 0];
  this.friction = 0.1;
  this.accely = 0.05;
};
Player.prototype = new Moveable(0, 0, 'rgb(0,0,0)');
Player.prototype.switchColor = function() {
  if (this.color === 'white')
    this.color = 'black';
  else {
    this.color = 'white';
  }
};
Player.prototype.destroy = function() {
  this.pos(this.originalPos);
  this.vx = 0;
  this.vy = 0;
};

Player.prototype.update = function(time) {
  Moveable.prototype.update.call(this, time);
  this.doCollisions();
};

Player.prototype.collideBody = function(dir, body) {
  if ((this.color === "white" && body.color === "black") ||
      (this.color === "black" && body.color === "white"))
    this.destroy();

  else if (dir == "bottom") {
    this._top = body._top - this.height;
    this.vy = 0;
    this.support = body;
  } else if (dir == "top") {
    this.vy = 0;
    this._top = body.bottom() + 1;
  } else if (dir == "right") {
    if (this.bouncy && !this.support) {
      this.vx = -4;
      this.vy = -2;
    } else {
      this._left = body._left - this.width;
      this.vx = Math.min(this.vx, 0);
    }
  } else if (dir == "left") {
    if (this.bouncy && !this.support) {
      this.vx = 4;
      this.vy = -2;
    } else {
      this._left = body.right();
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
  if (score == MAX_SCORE && CURRENT_LEVEL.next) {
    CURRENT_LEVEL = CURRENT_LEVEL.next;
    drawMap(CURRENT_LEVEL.map, this);
  }
};

function Enemy(width, height, color) {
  this.name = 'Enemy';
  this.width = width;
  this.height = height;
  this.color = color;

  this.terminalXVelocity = 3;
  this.terminalYVelocity = 5;

  this.support = null;
  this.bouncy = false;

  this.accelx = 0;
  this.accely = 0;
  this.dirx = 0;
}
Enemy.prototype = new Moveable(0, 0, 'rgb(0,0,0)');


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

  W, B, G = white, black and grey blocks
  i, b, g = white, black and grey coins
  @       = the player
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

level1 = level4;

/////////////////////
// level4.map = [  //
//   "   @",       //
//   "   W   W",   //
//   "",           //
//   " WW     WW", //
//   "  WWWWWWW",  //
// ];              //
/////////////////////


function drawMap(map, player) {
  BODIES = [];
  skewer.log('drawing');
  player.register();
  player.vx = 0;
  player.vy = 0;
  MAX_SCORE = 0;
  X_BOUNDS = [0, 0];
  Y_BOUNDS = [0, 0];

  score = 0;
  camera = {x: 0,
            y: 0,
            z: 0.1};
  var blockWidth = 50;
  var blockLength = 75;
  var blockParam = 1; // single parameter map maker can set
  var chaosMode = false; // randomize parameters
  for (var i in map) {
    level = map[i];
    for (var j in level) {
      if (chaosMode) blockParam = Math.random();

      character = level[j];
      x = j * blockWidth;
      y = i * blockLength;
      X_BOUNDS[0] = Math.min(X_BOUNDS[0], x);
      X_BOUNDS[1] = Math.max(X_BOUNDS[1], x);
      Y_BOUNDS[0] = Math.min(Y_BOUNDS[0], y);
      Y_BOUNDS[1] = Math.max(Y_BOUNDS[1], y);

      if (character === ' ') continue; // empty space
      else if (['W', 'B', 'G'].indexOf(character) > -1) { // blocks
        var body = new Body(blockWidth, blockLength,
                        {'W': 'white', 'B': 'black', 'G': 'grey'}[character])
          .pos(x, y).register();
        body.friction = 0.7;
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
        var elevator = new Elevator(blockWidth, blockLength, 'black', blockParam * 0.1);
        elevator.setOriginalPos(x, y);
        elevator.register();
      } else if (character == 'e') {
        var elevator = new Elevator(blockWidth, blockLength, 'white', blockParam * 0.1);
        elevator.setOriginalPos(x, y);
        elevator.register();
      } else if (['b', 'i', 'g'].indexOf(character) > -1) { // coins
        new Coin({
          'b': 'black',
          'i': 'white',
          'g': 'grey'
        }[character]).pos(x, y).register();
        MAX_SCORE++;
      }
    }
    X_BOUNDS[0] -= 400;
    X_BOUNDS[1] += 400;
    Y_BOUNDS[0] -= 400;
    Y_BOUNDS[1] += 400;
  }
  camera.x = player.centerx();
  camera.y = player.centery();
}

