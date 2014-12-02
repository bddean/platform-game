/////////////////////////////////// to do list ///////////////////////////////////
// TODO: sometimes the player bounces off the wall at weird angle
// TODO: jumping off the floor and the wall should be the same action

// TODO win condition / multiple levels
// TODO dying should restart the level or something
/* TODO rework collision logic.
   - I may only need to check for collisions between player and other things
   - Make it easier to separate collision callbacks from the state
   - If maps get big enough, use a heap instead of a list to hold bodies
*/

// TODO: real friction equation. i.e take weight into account
/*********** utility functions ***********/
function sign(x){
    if( +x === x ) { // check if a number was given
        return (x === 0) ? x : (x > 0) ? 1 : -1;
    }
    return NaN;
}

/************** constants etc **************/
var BODIES = [];
var WIDTH = 640;
var HEIGHT = 480;
var DELAY = 10;
var canvas = document.getElementById("game");
var ctx = canvas.getContext("2d");
var camera = {x : WIDTH/2,
              y : HEIGHT/2};

function Body(width, height, color)  {
  this.name = "Body";
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
  ctx.fillRect(this.left() - camera.x + WIDTH/2, this.top() - camera.y + HEIGHT/2,
               this.width, this.height);
};
Body.prototype.angleTo = function(other) {
  if (other.centerx() == this.centerx())
    return other.centery() > this.centery() ? 0.5 * Math.PI : 1.5 * Math.PI;
  else if (other.centery() == this.centery()) // not sure this check is needed
    return other.centerx() > this.centerx() ? 0 : Math.PI;
  return Math.atan((other.centery() - this.centery())/
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
      ((wy > -hx) ? "top" : "right") :
      ((wy > -hx) ? "left" : "bottom");
  }
  return false;
};
Body.prototype.onCollisionWith = function(type, callback) {
  /*
   * Callback to be called on a collision, passed (direction, other)
   */
  this.collisionCallbacks[type] = callback;
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
        if(col) {
          callback.call(this, col, BODIES[b]);
        }
      }
    }
  }
};

function Coin(color) {
  this.name = "Coin";
  this.width = 25;
  this.height = 25;
  this.color = color;

  this.collisionCallbacks = {};
}
Coin.prototype = new Body(0,0, "black");

function Moveable(width, height, color) {
//  this.__proto__ = 
  this.name = "Moveable";
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
Moveable.prototype = new Body(0,0,"rgb(0,0,0)");

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
Moveable.prototype.update = function() {
  this._left += this.vx;
  this._top += this.vy;

  this.vy += this.accely;
  var accelx = this.dirx * ((this.surface ? this.surface.friction * this.friction * 30 : 0)
        + 0.04);
  this.vx += accelx;


  if (this.support && this.dirx === 0) {
    this.vx *= (1 - this.friction * this.support.friction);
  }

  this.vx = sign(this.vx) * Math.min(Math.abs(this.vx), this.terminalXVelocity);
  this.vy = sign(this.vy) * Math.min(Math.abs(this.vy), this.terminalYVelocity);

  this.support = null;
  this.doCollisions();
};

var Player = function(width, height, color) {
  Moveable.apply(this, arguments);
  this.name = "Player";
  this.originalPos = [0, 0];
};
Player.prototype = new Moveable(0,0,"rgb(0,0,0)");
Player.prototype.switchColor = function() {
  if (this.color === "white")
    this.color = "black";
  else {
    this.color = "white";
  }
};
Player.prototype.destroy = function() {
  this.pos(this.originalPos);
  this._vx = 0;
  this._vy = 0;
};

Player.prototype.setOriginalPos = function(x, y) {
  this.originalPos = [x, y];
  this.pos(this.originalPos); // no idea y this doesn't work
};


function Enemy(width, height, color) {
  this.name="Enemy";
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
Enemy.prototype = new Moveable(0,0,"rgb(0,0,0)");


var clear = function() {
  ctx.fillStyle = "rgb(0, 191, 250)";
  ctx.fillRect(0,0, WIDTH, HEIGHT);
};

var key = 0;
var done = false;

var left_pressed = false;
var right_pressed = false;
var doKeyDown = function(k) {
  if (k.keyCode == 32)
    player.jump(4);
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
  } else if (k.keyCode == 81) { // Q
    player.bouncy = false;
  } else if (k.keyCode == 69) { // E
    player.switchColor();
  }
};

/*
  Maybe I should switch to a real map editor eventually. Using a map
  of characters for now.

  W, B, G = white, black and grey blocks
  i, b, g = white, black and grey coins
  @       = the player
*/ 
var map = [
  "",
  "",
  "                       W          ",
  "                       W          ",
  "                       W   BBBGGGWWGGGBBGGGWWGGGBBB b B            ",
  "                       W   B                      B b B             ",
  "                       W   B                      B b B             ",
  "                       W   B                      B   B             ",
  "                       W   B                      B   B             ",
  "                       W   B                      B   B             ",
  "                       W   B                      B i B             ",
  "                       W   B                      B i B             ",
  "                       W   B                      B i B             ",
  " @                         B                      B   B             ",
  "                           B                      B   B             ",
  "   iii        WWWW   BBBBBBB                      B b B             ",
  "                                                  B b B               ",
  "WWWWWWWWW",
  "                                                     ",
  "                                                   WWWWWWWWWWWWW    ",
  "",
  "",
  "",
  "",
  "WBWBWBWBWBWBWBWBWBWBWBWBWBWBWBWBWBWBWBWBWBWBWBWBWBWBWBWBWBWBWBWBWBWBWB" // lava!
];

function drawMap(map, player) {
  var blockWidth = 50;
  var blockLength = 75;
  for (var i in map) {
    level = map[i];
    for (var j in level) {
      character = level[j];
      x = j * blockWidth;
      y = i * blockLength;
      if (character === " ") continue; // empty space
      else if (["W", "B", "G"].indexOf(character) > -1) { // blocks
        body = new Body(blockWidth, blockLength,
                        {"W":"white", "B":"black", "G":"grey"}[character])
          .pos(x, y).register();
        body.friction = 0.7;
      } else if (character === "@") { // the player
        player.setOriginalPos(x, y);
      } else if (["b", "i", "g"].indexOf(character) > -1) { // coins
        new Coin({
          "b": "black",
          "i": "white",
          "g": "grey"
        }[character]).pos(x, y).register();
      }
    }
  }
}


