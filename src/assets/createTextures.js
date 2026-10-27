/** All gameplay artwork is local and generated once at boot. */
export function createTextures(scene) {
  const make = (key, width, height, paint) => {
    if (scene.textures.exists(key)) return;
    const texture = scene.textures.createCanvas(key, width, height);
    paint(texture.context, width, height);
    texture.refresh();
  };

  const shape = (ctx, points, fill, stroke, width = 2) => {
    ctx.beginPath();
    points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
  };

  const line = (ctx, points, color, width = 2) => {
    ctx.beginPath();
    points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  };

  const kitten = (ctx, frame = 0, solar = false) => {
    const stride = [0, 7, 0, -7][frame];
    const accent = solar ? '#ffe66d' : '#00f3ff';
    ctx.lineJoin = 'round';
    ctx.shadowColor = accent;
    ctx.shadowBlur = 7;
    // The angular tail and scarf keep the silhouette readable at running speed.
    line(ctx, [[56, 79], [32, 80], [18, 67], [11, 47], [16, 40]], solar ? '#ffffff' : '#eac4ac', 12);
    line(ctx, [[19, 62], [13, 49], [16, 43]], solar ? '#ffe66d' : '#ff9c50', 6);
    ctx.shadowBlur = 0;
    shape(ctx, [[65, 44], [44, 39], [30, 48], [7, 41], [18, 56], [4, 64], [37, 65], [65, 58]], solar ? '#dba52c' : '#f318a9', solar ? '#fff3b0' : '#ff65e4', 2);
    shape(ctx, [[39, 48], [17, 48], [30, 53], [11, 60], [41, 58]], solar ? '#956a1c' : '#a51a83');
    // Back leg, pale jacket and warm fur.
    shape(ctx, [[65, 81], [77, 84], [70 + stride, 109], [49 + stride, 109], [51 + stride, 98]], '#18162e', '#655384', 2);
    shape(ctx, [[48 + stride, 102], [69 + stride, 102], [74 + stride, 113], [43 + stride, 113], [43 + stride, 108]], '#16172e', accent, 2);
    shape(ctx, [[54, 56], [74, 47], [98, 52], [112, 73], [104, 96], [63, 94], [49, 77]], solar ? '#f5f5ff' : '#f0dbc6', solar ? '#ffffff' : '#fff0d9', 2);
    shape(ctx, [[59, 61], [72, 52], [85, 58], [78, 75], [57, 76]], solar ? '#ffe66d' : '#f9a65e');
    shape(ctx, [[70, 76], [94, 72], [102, 88], [90, 97], [66, 90]], '#242239', '#6a6080', 2);
    line(ctx, [[75, 83], [91, 82]], accent, 3);
    ctx.fillStyle = solar ? '#ffe66d' : '#ff00d9'; ctx.fillRect(63, 80, 5, 5);
    // Head: asymmetric ears, orange forehead and black wraparound visor.
    shape(ctx, [[78, 48], [74, 13], [95, 27], [112, 22], [132, 10], [132, 40], [145, 54], [138, 72], [109, 79], [87, 68]], solar ? '#ffffff' : '#f8e8d2', solar ? '#ffffff' : '#fff4df', 2);
    shape(ctx, [[79, 20], [83, 42], [94, 31]], solar ? '#dba52c' : '#ed9ca4');
    shape(ctx, [[126, 19], [115, 29], [128, 35]], solar ? '#dba52c' : '#ed9ca4');
    shape(ctx, [[96, 27], [113, 24], [122, 37], [109, 42], [100, 35]], solar ? '#ffe66d' : '#f89b53');
    shape(ctx, [[85, 44], [133, 39], [145, 50], [138, 58], [93, 62], [83, 55]], '#0c1630', accent, 2);
    ctx.shadowColor = accent; ctx.shadowBlur = 9;
    line(ctx, [[103, 48], [114, 46], [111, 53]], solar ? '#ffffff' : '#53ffff', 3);
    line(ctx, [[127, 45], [136, 45], [132, 51]], solar ? '#ffffff' : '#53ffff', 3);
    ctx.shadowBlur = 0;
    shape(ctx, [[137, 59], [145, 61], [139, 65]], '#dc7d82');
    line(ctx, [[126, 69], [133, 71], [139, 68]], '#9b6878', 1.5);
    line(ctx, [[142, 65], [153, 64]], '#d7b2a7', 1);
    line(ctx, [[140, 69], [150, 73]], '#d7b2a7', 1);
    // Scarf collar and forward cyber paw.
    shape(ctx, [[80, 66], [100, 72], [107, 81], [89, 83], [74, 74]], solar ? '#dba52c' : '#f418b1', solar ? '#fff3b0' : '#ff7be8', 1.5);
    shape(ctx, [[94, 86], [104, 85], [108 - stride, 104], [124 - stride, 107], [123 - stride, 115], [99 - stride, 115], [88, 99]], '#18162e', '#80718c', 2);
    line(ctx, [[104 - stride, 109], [120 - stride, 109]], accent, 3);
    shape(ctx, [[109, 77], [122, 76], [127, 86], [119, 92], [107, 87]], solar ? '#ffffff' : '#f3d1b4', solar ? '#ffffff' : '#fff0d8', 1.5);
    line(ctx, [[121, 81], [132, 77]], accent, 2);
    line(ctx, [[123, 86], [135, 83]], accent, 2);
  };

  make('kitten', 160, 128, ctx => kitten(ctx));
  for (let frame = 0; frame < 4; frame++) make(`kitten-run-${frame}`, 160, 128, ctx => kitten(ctx, frame));
  make('kitten-solar', 160, 128, ctx => kitten(ctx, 0, true));
  for (let frame = 0; frame < 4; frame++) make(`kitten-solar-run-${frame}`, 160, 128, ctx => kitten(ctx, frame, true));

  const dog = (ctx, frame = 0, hound = false) => {
    const accent = hound ? '#ffe66d' : '#ff20d7';
    const stride = [0, 8, 0, -8][frame];
    ctx.lineJoin = 'round';
    ctx.shadowColor = accent; ctx.shadowBlur = 5;
    // Facing left, with a segmented mechanical spine and exhaust tail.
    shape(ctx, [[101, 46], [120, 35], [132, 18], [129, 44], [112, 58]], '#27142f', accent, 2);
    shape(ctx, [[48, 48], [84, 38], [111, 51], [111, 76], [95, 86], [56, 79], [42, 64]], '#24172e', accent, 2);
    shape(ctx, [[62, 45], [84, 38], [102, 44], [94, 58], [63, 61]], '#513251', accent, 1.5);
    ctx.shadowBlur = 0;
    for (let index = 0; index < 4; index++) line(ctx, [[70 + index * 7, 46], [67 + index * 7, 54]], accent, 2);
    shape(ctx, [[44, 53], [43, 23], [31, 32], [18, 24], [20, 46], [7, 57], [8, 70], [33, 76], [50, 65]], '#322039', accent, 2);
    shape(ctx, [[18, 47], [40, 45], [37, 57], [14, 60]], '#0a101e', '#00f3ff', 1.5);
    ctx.shadowColor = '#00f3ff'; ctx.shadowBlur = 9;
    line(ctx, [[16, 51], [29, 50]], '#88ffff', 3);
    ctx.shadowBlur = 0;
    shape(ctx, [[5, 59], [21, 61], [20, 69], [7, 68]], '#111020', '#a3699e', 1);
    shape(ctx, [[23, 72], [27, 82], [31, 73]], '#fff0d8');
    shape(ctx, [[33, 73], [37, 80], [40, 72]], '#fff0d8');
    // Pistons and taloned feet.
    shape(ctx, [[51, 72], [64, 75], [54 + stride, 94], [39 + stride, 96], [34 + stride, 102], [57 + stride, 102], [72, 80]], '#181629', accent, 1.5);
    shape(ctx, [[95, 74], [108, 70], [113 - stride, 92], [105 - stride, 102], [79 - stride, 102], [84 - stride, 95], [97 - stride, 92]], '#181629', accent, 1.5);
    line(ctx, [[49 + stride, 96], [43 + stride, 101]], '#00f3ff', 2);
    line(ctx, [[94 - stride, 96], [88 - stride, 101]], '#00f3ff', 2);
    ctx.fillStyle = accent; ctx.fillRect(104, 52, 5, 13);
    if (hound) {
      shape(ctx, [[53, 42], [60, 20], [68, 40], [78, 17], [84, 39], [94, 24], [101, 44]], '#564233', '#ffe66d', 2);
      line(ctx, [[12, 34], [3, 27]], '#ffe66d', 2);
    }
  };
  make('dog', 140, 110, ctx => dog(ctx));
  make('hound', 140, 110, ctx => dog(ctx, 0, true));
  for (let frame = 0; frame < 4; frame++) {
    make(`dog-run-${frame}`, 140, 110, ctx => dog(ctx, frame));
    make(`hound-run-${frame}`, 140, 110, ctx => dog(ctx, frame, true));
  }

  make('drone', 120, 80, ctx => {
    line(ctx, [[13, 32], [35, 39], [85, 39], [107, 32]], '#934fbb', 5);
    ctx.shadowColor = '#ff00ff'; ctx.shadowBlur = 8;
    shape(ctx, [[36, 28], [48, 17], [75, 17], [90, 33], [79, 54], [43, 54]], '#211c3e', '#ff41dd', 2);
    shape(ctx, [[42, 33], [83, 33], [76, 45], [48, 45]], '#071a31', '#00f3ff', 2);
    ctx.fillStyle = '#ffe66d'; ctx.fillRect(54, 35, 15, 4);
    line(ctx, [[4, 24], [30, 24]], '#00f3ff', 3);
    line(ctx, [[91, 24], [116, 24]], '#00f3ff', 3);
    line(ctx, [[13, 23], [13, 39]], '#ded0fa', 2);
    line(ctx, [[105, 23], [105, 39]], '#ded0fa', 2);
    shape(ctx, [[48, 57], [58, 57], [53, 75]], '#ff20b7');
    shape(ctx, [[69, 57], [79, 57], [74, 75]], '#ff20b7');
  });

  make('human-catcher', 112, 190, ctx => {
    ctx.lineJoin = 'round';
    ctx.shadowColor = '#ff304f';
    ctx.shadowBlur = 14;
    shape(ctx, [[47, 12], [67, 12], [76, 27], [70, 48], [45, 48], [37, 29]], '#170b1b', '#ff304f', 3);
    shape(ctx, [[31, 53], [78, 51], [88, 104], [70, 126], [41, 124], [23, 101]], '#1a0b21', '#ff304f', 4);
    line(ctx, [[32, 64], [12, 92], [20, 126]], '#2b1029', 12);
    line(ctx, [[78, 64], [98, 91], [91, 124]], '#2b1029', 12);
    line(ctx, [[45, 121], [35, 174], [21, 184]], '#1a0b21', 15);
    line(ctx, [[67, 121], [78, 174], [94, 184]], '#1a0b21', 15);
    ctx.shadowBlur = 6;
    shape(ctx, [[42, 27], [71, 25], [68, 36], [45, 38]], '#050711', '#ff667d', 2);
    line(ctx, [[47, 31], [66, 29]], '#ffccd3', 3);
    line(ctx, [[35, 64], [75, 61]], '#ff304f', 3);
    line(ctx, [[39, 78], [79, 76]], '#ff6b81', 2);
    ctx.fillStyle = '#ff304f';
    ctx.fillRect(84, 92, 12, 18);
  });

  make('emp-net', 72, 72, ctx => {
    ctx.shadowColor = '#ff304f';
    ctx.shadowBlur = 12;
    ctx.strokeStyle = '#ff304f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(36, 36, 29, 0, Math.PI * 2);
    ctx.stroke();
    for (const offset of [19, 28, 36, 44, 53]) {
      line(ctx, [[13, offset], [59, 72 - offset]], '#ff8b9d', 1.5);
      line(ctx, [[offset, 13], [72 - offset, 59]], '#ff8b9d', 1.5);
    }
    for (const [x, y] of [[36, 7], [65, 36], [36, 65], [7, 36]]) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  for (const [key, size] of [['spark', 32], ['glow', 128]]) {
    make(key, size, size, ctx => {
      const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      gradient.addColorStop(0, '#ffffff');
      gradient.addColorStop(0.12, 'rgba(255,255,255,.95)');
      gradient.addColorStop(0.38, 'rgba(255,255,255,.28)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, size, size);
    });
  }

  make('shard', 24, 24, ctx => {
    shape(ctx, [[12, 0], [18, 12], [12, 24], [6, 12]], '#fff');
  });
  make('neon-shard', 32, 40, ctx => {
    shape(ctx, [[16, 2], [29, 19], [16, 38], [3, 19]], '#5c5c5c', '#fff', 2);
    shape(ctx, [[16, 7], [23, 19], [16, 33], [9, 19]], '#fff');
    line(ctx, [[16, 3], [16, 37]], '#fff', 1);
  });
  make('pixel', 8, 8, ctx => { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 8, 8); });
  make('orb', 48, 48, ctx => {
    ctx.shadowColor = '#00f3ff'; ctx.shadowBlur = 10;
    shape(ctx, [[24, 5], [39, 14], [39, 32], [24, 42], [9, 32], [9, 14]], '#07384d', '#3cffff', 2);
    shape(ctx, [[24, 12], [32, 23], [24, 35], [16, 23]], '#b4ffff');
    line(ctx, [[24, 16], [24, 29]], '#ffffff', 2);
  });

  make('wings', 220, 110, ctx => {
    ctx.shadowColor = '#00f3ff'; ctx.shadowBlur = 10;
    for (const flip of [-1, 1]) {
      ctx.save(); ctx.translate(110, 92); ctx.scale(flip, 1);
      shape(ctx, [[0, 0], [26, -44], [100, -81], [77, -41], [48, -31], [85, -36], [58, -7], [28, -7], [54, -3], [26, 8]], 'rgba(0,243,255,.10)', '#63ffff', 2);
      line(ctx, [[5, -2], [36, -39], [90, -72]], '#ff6cf4', 1.5);
      ctx.restore();
    }
  });

  make('road', 512, 172, (ctx, width, height) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#10132e');
    gradient.addColorStop(0.5, '#090b1d');
    gradient.addColorStop(1, '#130820');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
    let seed = 77;
    const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 1300; i++) {
      ctx.fillStyle = `rgba(90,110,160,${random() * 0.09})`;
      ctx.fillRect(random() * width, random() * height, random() * 8 + 1, 1);
    }
  });
}
