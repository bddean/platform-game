score = 0;
BODIES = [];
currentLevel = level1;

addEventListener("keydown", doKeyDown,true);
addEventListener("keyup", doKeyUp, true);

var player = new Player(50, 50, "white").pos(20,300).register();
player.vy = 0;
player.accely = 0.05;

drawMap(currentLevel.map, player);

player.onCollisionWith(Block, player.collideBlock);
player.onCollisionWith(Coin, player.collideCoin);

var destX, destY;
var t1 = new Date().getTime();
var t2 = t1;
var main = function() {
  clear();
  // update camera
  destX = player.centerx() + player.vx * 25;
  destY = player.centery() + player.vy * 50;

  camera.x += (-camera.x + destX) / 30;
  camera.y += (-camera.y + destY) / 30;
  camera.z += camera.z * (NORMAL_CAMERA_HEIGHT - camera.z) / 20;
  camera.z = Math.min(camera.z, NORMAL_CAMERA_HEIGHT);

  // update bodies
  t2 = new Date().getTime();
  for (var b in BODIES) {
    BODIES[b].update((t2 - t1) / 10);
    BODIES[b].draw();
  }
  t1 = t2;

  // draw score
  ctx.fillStyle = "black";
  ctx.font="20px Arial";
  ctx.fillText(score + "/" + maxScore, 0, 20);
};

var requestAnimationFrame =
      requestAnimationFrame       ||
      webkitRequestAnimationFrame ||
      mozRequestAnimationFrame    ||
      function( callback ) {
        window.setTimeout(callback, 1000 / 60);
      };

(function mainLoop() {
  requestAnimationFrame(mainLoop);
  main();
})();


