// TODO: real friction equation. i.e take weight into account
// TODO: collision direction should be based on velocity? nno, that won't work either
//  angle from nearest edge would make more sense
var BODIES = [];
var WIDTH = 640;
var HEIGHT = 480;
var DELAY = 10;
var canvas = document.getElementById("game");
var ctx = canvas.getContext("2d");

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
  if (arguments.length == 0) {
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
Body.prototype.top = function() { return this._top; };
Body.prototype.left = function() { return this._left; };
Body.prototype.bottom = function() { return this._top + this.height; };
Body.prototype.right = function() { return this._left + this.width; };
Body.prototype.centerx = function() { return this._left + this.width / 2; };
Body.prototype.centery = function() { return this._top + this.height / 2; };
Body.prototype.draw = function() {
  ctx.fillStyle = this.color;
  ctx.fillRect(this.left(), this.top(), this.width, this.height);
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
  if (this.left() > other.right() ||
      this.right() < other.left() ||
      this.top() > other.bottom() ||
      this.bottom() < other.top()) {
    return false;
  }
  var angle = this.angleTo(other);
  var eighths = angle / 0.25 * Math.PI;

  // Get angle of collision to get direction
  if (eighths > 7 || eighths <= 1)
    return "right";
  else if (eighths <= 3)
    return "top";
  else if (eighths <= 5)
    return "left";
  return "bottom";
};
Body.prototype.onCollisionWith = function(type, callback) {
  /*
   * Callback to be called on a collision, passed (direction, other)
   */
  // TODO?: Are multiple callbacks for a type necessary?
  this.collisionCallbacks[type] = callback;
};
Body.prototype.update = function() {
  // default - do nothing
},
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


function Moveable(width, height, color) {
//  this.__proto__ = 
  this.name = "Moveable";
  this.width = width;
  this.height = height;
  this.color = color;

  this.terminalXVelocity = 3;
  this.terminalYVelocity = 5;
  this.support = null;
  this.accelx = 0;
  this.accely = 0;
  this.dirx = 0;
};
Moveable.prototype = new Body(0,0,"rgb(0,0,0)");
Moveable.prototype.velocity = function(x, y) {
  if (x == undefined) return [this.vx, this.vy];

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

  this.vx = Math.min(this.vx, this.terminalXVelocity);
  this.vy = Math.min(this.vy, this.terminalYVelocity);

  this.support = null;
  this.doCollisions();
};

var clear = function() {
  ctx.fillStyle = "rgb(0, 191, 250)";
  ctx.fillRect(0,0, WIDTH, HEIGHT);
};

var key = 0;
var done = false;

var player = new Moveable(20, 60, "rgb(0, 250, 0)").pos(20, 300).register();
player.friction = 0.1;
player.name = "player";
player.vy = 0;
player.accely = 0.05;
player.fire = function(x, y, r) {
  // this is wrong -- vx 
  if (x == this.centerx()) x += 1;
  var angle = Math.atan((y - this.centery()) / (x - this.centerx()));
  // angle += Math.random() / 4;
  direction =  x > this.centerx() ? 1 : -1;
  var xvel = r * Math.cos(angle);
  xvel *= direction;
  var yvel = r * Math.sin(angle);
  yvel *= direction;
  var bullet = new Moveable(15, 15, "rgb(250, 200, 200)")
    .pos(this.centerx(), this.centery())
    .velocity(xvel, yvel)
    .register();
  bullet.accely = 0.05;
  bullet.friction = 0.5;
  // bullet.onCollisionWith("Body", function(dir, body) {
  //   this.support = body;
  // });
};

player.onCollisionWith("Body", function(dir, body) {
  //    if (dir == "bottom") {
  if (Math.abs(this.angleTo(body)) < Math.PI / 2) {
    this._top = body._top - this.height;
    this.vy = 0;
    this.support = body;
  }
});
var floor = new Body(200, 20, "rgb(75, 75, 75)").pos(10, 400).register();
floor.friction = 0.5;

var floor2 = new Body(200, 20, "rgb(75, 75, 75)").pos(300, 300).register();
floor2.friction = 0.1;
var doKeyDown = function(k) {
  var accel = player.support ? 0.1 : 0.06;
  if (k.keyCode == 32)
    player.jump(5);
  else if (k.keyCode == 65) // A
//    player.accelx = -accel;
    player.dirx = -1;
  else if (k.keyCode == 68) // D
//    player.accelx = accel;
    player.dirx = 1;
};
addEventListener("keydown",doKeyDown,true);
addEventListener("keyup", function(k) {
  console.log(k.keyCode);
  if (k.keyCode == 65) // A
    player.dirx = 0;
  else if (k.keyCode == 68) // D
    player.dirx = 0;
}, true);
addEventListener("click", function(e) {
  console.log(e);
  player.fire(e.x, e.y, 20);
});
var main = function() {
  clear();
  for (b in BODIES) {
    BODIES[b].update();
    BODIES[b].draw();
  }
};
console.log("loaded!");
setInterval(main, DELAY);
