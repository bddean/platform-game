score = 0;
BODIES = [];


addEventListener("keydown", doKeyDown,true);
addEventListener("keyup", doKeyUp, true);

var player = new Player(50, 50, "white").pos(20,300).register();
player.vy = 0;
player.accely = 0.05;

drawMap(CURRENT_LEVEL.map, player);


player.onCollisionWith("Body", function(dir, body) {
  if ((player.color === "white" && body.color === "black") ||
      (player.color === "black" && body.color === "white"))
    player.destroy();

  else if (dir == "bottom") {
    this._top = body._top - this.height;
    this.vy = 0;
    this.support = body;
  } else if (dir == "top") {
    this.vy = 0;
    this._top = body.bottom() + 1;
  } else if (dir == "right") {
    if (player.bouncy && !player.support) {
      this.vx = -4;
      this.vy = -2;
    } else {
      this._left = body._left - this.width;
      this.vx = Math.min(this.vx, 0);
    }
  } else if (dir == "left") {
    if (player.bouncy && !player.support) {
      this.vx = 4;
      this.vy = -2;
    } else {
      this._left = body.right();
      this.vx = Math.max(this.vx, 0);
    }
  }
});
player.onCollisionWith("Coin", function(dir, coin) {
  if ((player.color === "white" && coin.color === "black") ||
      (player.color === "black" && coin.color === "white"))
    player.destroy();
  else {
    coin.destroy();
    score += 1;
  }
  if (score == MAX_SCORE && CURRENT_LEVEL.next) {
    CURRENT_LEVEL = CURRENT_LEVEL.next;
    drawMap(CURRENT_LEVEL.map, player);
  }
});


camera.x = player.centerx();
camera.y = player.centery();

var destX, destY;
var main = function() {
  clear();
  // update camera
  destX = player.centerx() + player.vx * 25;
  destY = player.centery() + player.vy * 50;

  camera.x += (-camera.x + destX) / 30;
  camera.y += (-camera.y + destY) / 30;

  // update bodies
  for (var b in BODIES) {
    BODIES[b].update();
    BODIES[b].draw();
  }

  // draw score
  ctx.fillStyle = "black";
  ctx.font="20px Arial";
  ctx.fillText(score + "/" + MAX_SCORE, 0, 20);
};

//TODO: use window.requestAnimationFrame
setInterval(main, DELAY);
