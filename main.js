import "./style.css";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Water } from "three/examples/jsm/objects/Water.js";
import { Sky } from "three/examples/jsm/objects/Sky.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import dat from 'dat.gui';

let camera, scene, renderer;
let controls, water, moon;
let boat;
let accelerationview;
let ff;
let propview;

const loader = new GLTFLoader();
const housePositions = [
  -2000, -1800, -1600, -1400, -1200, -1000, -800, -600, -400, -200, 200, 400,
  600, 800, 1000, 1200, 1400, 1600, 1800, 2000,
];
const treePositions = [
  -1900, -1690, -1500, -1290, -1100, -890, -700, -490, -280, -100, -50, 100, 50,
  300, 510, 700, 890, 1100, 1290, 1500, 1690, 1900,
];
const towerPositions = [-75, 75];

let userInteracting = false;
let interactionTimeout;
let followBoat = true; // حالة متابعة القارب

class Vector {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  sum(second) {
    return new Vector(this.x + second.x, this.y + second.y, this.z + second.z);
  }

  mult_num(second) {
    return new Vector(this.x * second, this.y * second, this.z * second);
  }

  divide_scalar(scalar) {
    return new Vector(this.x / scalar, this.y / scalar, this.z / scalar);
  }

  lenth() {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }

  clone() {
    return new Vector(this.x, this.y, this.z);
  }

  negate() {
    return new Vector(-this.x, -this.y, -this.z);
  }

  multiply_scalar(scalar) {
    return new Vector(this.x * scalar, this.y * scalar, this.z * scalar);
  }
}

class Boat {
  constructor() {
    this.m = 1;  // Mass of the boat
    this.waterro = 1.3;  // Water density
    this.length = 2;  // Boat dimensions
    this.width = 1;
    this.hight = 0.5;
    this.g = 9.8;  // Acceleration due to gravity
    this.dt = 0.05;  // Time step
    this.v = new Vector(0, 0, 0);  // Velocity
    this.pos = new Vector(0, 0, 100);  // Position
    this.max_prop = 3;  // Maximum propulsion force
    this.min_prop = 0;  // Minimum propulsion force
    this.coreprop = 0;  // Current propulsion force
    this.cd = 0.1;  // Drag coefficient
    this.max_rotation = 0.002;  // Maximum rotation force
    this.min_rotation = -0.002;  // Minimum rotation force
    this.rotationSpeed = 0;  // Rotation speed
    this.rotationAngle = 0;  // Current rotation angle
    this.waveAmplitude = 0.05;  // Wave amplitude
    this.waveFrequency = 0.2;  // Wave frequency
    this.waveSpeed = 0.12;      // Wave speed
    this.waveOffset = 0;       // To track wave phase over time
    this.collisionStrength = 50; // زيادة قوة الصدم
    this.collisionDamping =0.5; // تقليل السرعة بشكل أكبر بعد التصادمدم
 this.collisionDirection = new Vector(0, 0, 0); // تخزين اتجاه الاصطدام
    this.windSpeed = 2.0;  // سرعة الرياح
 this.windDirection = new Vector(0, 0, 0);  // اتجاه الرياح

 loader.load("assets/boat/scene.gltf", (gltf) => {
      scene.add(gltf.scene);
      gltf.scene.scale.set(3, 3, 3);
      gltf.scene.position.set(5, 1, 50);
      gltf.scene.rotation.y = 0.2;

      this.boat = gltf.scene;
    });
  }

  stop() {
    this.v = new Vector(0, 0, 0);
  }

  gravity() {
    return new Vector(0, -this.m * this.g, 0);
  }

  ark() {
    return new Vector(0, this.waterro * this.volum() * this.g, 0);
  }

  depth() {
    return this.pos.y >= this.hight ? 0 : this.hight - this.pos.y;
  }

  volum() {
    return this.depth() * this.length * this.width;
  }
  windForce() {
    // القوة = سرعة الرياح * اتجاه الرياح
    return this.windDirection.multiply_scalar(this.windSpeed);
  }
    forses() {
    let f = new Vector(0, 0, 0);
    f = f.sum(this.gravity());
    f = f.sum(this.ark());
    f = f.sum(this.prop());
    f = f.sum(this.fric());
    f = f.sum(this.waveForce().vertical);
    f = f.sum(this.windForce()); // 
    return f;
  }

  calculat_a() {
    return this.forses().divide_scalar(this.m);
  }

  calculat_v() {
    let aa = this.calculat_a().clone().multiply_scalar(this.dt);
    this.v = this.v.sum(aa);
  }

  calculat_pos() {
    this.calculat_v();
    let vv = this.v.clone().multiply_scalar(this.dt);
    this.pos = this.pos.sum(vv);
  }

  prop() {
     
    // توجيه الدفع بناءً على الميلان الأفقي
    const waveImpact = this.waveForce();

    // تعديل الاتجاه بناءً على الميلان الأفقي
    const direction = new Vector(
      Math.sin(this.rotationAngle),
      0,
      Math.cos(this.rotationAngle)
    );

    // إضافة قوة الدفع الأساسية
    return direction.multiply_scalar(this.coreprop);
  }
  

  forword() {
    if (this.coreprop + 1 <= this.max_prop) this.coreprop += 1;
  }

  backword() {
    if (this.coreprop - 1 >= this.min_prop) this.coreprop -= 1;
  }

  fric() {
    let vval = this.v.lenth();
    let val = 0.5 * this.waterro * vval * vval * this.cd;
    return new Vector(0, 0, -val);
    
  }

  

  rotateRight() {
    if (this.rotationSpeed + 0.001 <= this.max_rotation) this.rotationSpeed += 0.001;
  }
  rotateLeft() {
    if (this.rotationSpeed - 0.001 >= this.min_rotation) this.rotationSpeed -= 0.001;
  }
  waveForce() {
    // التأثير الرأسي
    const waveHeight = Math.sin(this.waveOffset + this.pos.z * this.waveFrequency) * this.waveAmplitude;

    // التأثير الأفقي (يمينا ويسارا)
    const waveTilt = Math.cos(this.waveOffset + this.pos.x * this.waveFrequency) * (this.waveAmplitude / 2);

    // التأثير الناتج على القارب
    this.waveOffset += this.dt * this.waveSpeed;

    // تأثير الاهتزاز للأمام والخلف (Pitch)
    const waveImpactFront = Math.sin(this.waveOffset + (this.pos.z + this.length / 2) * this.waveFrequency) * this.waveAmplitude;
    const waveImpactBack = Math.sin(this.waveOffset + (this.pos.z - this.length / 2) * this.waveFrequency) * this.waveAmplitude;
    const wavePitch = (waveImpactFront - waveImpactBack) / this.length;

    return {
      vertical: new Vector(0, waveHeight, 0),
      tilt: waveTilt,
      pitch: wavePitch
    };
    
  }
  handleCollision() {
    // حساب قوة الارتداد بناءً على قوة التصادم والتخميد
    const bounceBackForce = this.v.negate().multiply_scalar(this.collisionDamping);
  
    // تحديث السرعة بناءً على قوة الارتداد
    this.v = this.v.sum(bounceBackForce);
  
    // تأكد من أن السرعة لا تصبح صفرًا تمامًا
    const minVelocity = 0.01; // الحد الأدنى للسرعة للحفاظ على الحركة
    if (this.v.lenth() < minVelocity) {
      this.v = this.v.multiply_scalar(minVelocity / this.v.lenth());
    }
  
    // تقليل قوة الدفع تدريجياً حتى يتوقف القارب تماماً
    const reducePropulsion = () => {
      if (this.coreprop > 0) {
        this.coreprop -= 1;  // تقليل القوة ببطء
        if (this.coreprop < 0) this.coreprop = 0;  // التأكد من عدم التراجع لأقل من 0
        requestAnimationFrame(reducePropulsion);
      }
    };

    reducePropulsion();
  }

  update() {
    this.calculat_pos();
    this.rotationAngle += this.rotationSpeed;
    this.boat.rotation.y += this.rotationSpeed;
    if (this.pos.z >= 450) {
      this.handleCollision();
     // this.m = 100;
    }
    


    if (this.boat) {
      const waveImpact = this.waveForce();

      // تحديث موضع القارب عموديًا وفقًا لتأثير الأمواج
      this.boat.position.set(this.pos.x, this.pos.y + 2 + waveImpact.vertical.y, this.pos.z);

      // إضافة تأثير التمايل (Rolling) للقارب
      this.boat.rotation.z = waveImpact.tilt;
      this.boat.rotation.x = waveImpact.pitch;
      // حساب الاتجاه الجديد بناءً على زاوية الدوران
      const direction = new Vector(
       Math.sin(this.boat.rotation.y),
       0,
       Math.cos(this.boat.rotation.y)
     );
   // تحديث الموضع بناءً على الاتجاه الجديد
   this.v = direction.multiply_scalar(this.v.lenth());
   const currentY = this.boat.position.y;
   this.boat.position.set(
     this.pos.x + this.v.x * this.dt,
     currentY, 
     this.pos.z + this.v.z * this.dt
   );
   
    
      // Update camera position based on boat following
      if (followBoat) {
        if (!userInteracting) {
          const offset = new Vector(0, 5, -20);
          const cameraRelativePosition = this.boat.localToWorld(new THREE.Vector3(offset.x, offset.y, offset.z));

          if (isBoatVisible(this.boat)) {
            // Smoothly move the camera towards the target position
            camera.position.lerp(cameraRelativePosition, 0.1);
            camera.lookAt(this.boat.position);
          } else {
            // Reset camera position if boat is not visible
            camera.position.set(0, 5, -8);
            camera.lookAt(new THREE.Vector3(0, 3, 0));
          }
        }
      }
    }
  }
 
}

class House {
  constructor() {
    loader.load("assets/house/scene.gltf", (gltf) => {
      housePositions.forEach((pos) => {
        const house = gltf.scene.clone();
        house.scale.set(10, 10, 10);
        house.position.set(pos, 2, -115);
        scene.add(house);
      });
    });
  }
}

class Tree {
  constructor() {
    loader.load("assets/tree/scene.gltf", (gltf) => {
      treePositions.forEach((pos) => {
        const tree = gltf.scene.clone();
        tree.scale.set(1, 0.5, 1);
        tree.position.set(pos, 0, -120);
        scene.add(tree);
      });
    });
  }
}


class Stairs {
  constructor() {
    loader.load("assets/play/scene.gltf", (gltf) => {
      const stairs = gltf.scene;
      stairs.scale.set(0.1, 0.1, 0.1);
      stairs.position.set(5, 15, -115);
      stairs.rotation.y = Math.PI / 2;
      scene.add(stairs);
    });
  }
}

class Tower {
  constructor() {
    loader.load("assets/tower/scene.gltf", (gltf) => {
      towerPositions.forEach((pos) => {
        const tower = gltf.scene.clone();
        tower.scale.set(6, 8, 6);
        tower.position.set(pos, 1, -120);
        scene.add(tower);
      });
    });
  }
}

class Island {
  constructor() {
    loader.load('assets/island/scene.gltf', (gltf) => {
      const island = gltf.scene;
      island.scale.set(100, 100, 100);
      island.position.set(5, 2, 850);//2050
      scene.add(island);
    });
  }
}

init();
animate();

async function init() {
  renderer = new THREE.WebGLRenderer();
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  document.body.appendChild(renderer.domElement);

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(
    55,
    window.innerWidth / window.innerHeight,
    1,
    20000
  );
  camera.position.set(0, 5, -20); // ضبط موقع الكاميرا الأولي خلف القارب

  moon = new THREE.Vector3();

  // Water
  const waterGeometry = new THREE.PlaneGeometry(10000, 10000);water = new Water(waterGeometry, {
    textureWidth: 512,
    textureHeight: 512,
    waterNormals: new THREE.TextureLoader().load(
      "assets/waternormals.jpg",
      function (texture) {
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      }
    ),
    sunDirection: new THREE.Vector3(),
    sunColor: 0x333355,
    waterColor: 0x001e0f,
    distortionScale: 3.7,
    fog: scene.fog !== undefined,
    clipBias: 0.1,
  });

  water.rotation.x = -Math.PI / 2;
  water.position.z = 5000; // Move the water plane forward to make room for the beach
  scene.add(water);

  // Skybox
  const sky = new Sky();
  sky.scale.setScalar(10000);
  scene.add(sky);

  const skyUniforms = sky.material.uniforms;
  skyUniforms["turbidity"].value = 2;
  skyUniforms["rayleigh"].value = 0.1;
  skyUniforms["mieCoefficient"].value = 0.005;
  skyUniforms["mieDirectionalG"].value = 0.8;

  const parameters = {
    elevation: 10,
    azimuth: 180,
  };

  const pmremGenerator = new THREE.PMREMGenerator(renderer);

  function updateMoon() {
    const phi = THREE.MathUtils.degToRad(90 - parameters.elevation);
    const theta = THREE.MathUtils.degToRad(parameters.azimuth);

    moon.setFromSphericalCoords(1, phi, theta);

    sky.material.uniforms["sunPosition"].value.copy(moon);
    water.material.uniforms["sunDirection"].value.copy(moon).normalize();

    scene.environment = pmremGenerator.fromScene(sky).texture;
  }

  updateMoon();

  controls = new OrbitControls(camera, renderer.domElement);
  controls.maxPolarAngle = Math.PI * 0.495;
  controls.target.set(0, 10, 0);
  controls.minDistance = 40.0;
  controls.maxDistance = 200.0;
  controls.update();

  controls.addEventListener("start", () => {
    userInteracting = true;
    clearTimeout(interactionTimeout);
  });

  controls.addEventListener("end", () => {
    interactionTimeout = setTimeout(() => {
      userInteracting = false;
    });
  });

  // Adding stars
  const starsGeometry = new THREE.BufferGeometry();
  const starsMaterial = new THREE.PointsMaterial({ color: 0x888888 });

  const starVertices = [];
  for (let i = 0; i < 10000; i++) {
    const x = THREE.MathUtils.randFloatSpread(10000);
    const y = THREE.MathUtils.randFloat(130, 10000);
    const z = THREE.MathUtils.randFloatSpread(10000);
    starVertices.push(x, y, z);
  }
  starsGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(starVertices, 3)
  );
  const stars = new THREE.Points(starsGeometry, starsMaterial);
  scene.add(stars);

  // Adding the beach
  const textureLoader = new THREE.TextureLoader();
  const beachTexture = textureLoader.load("assets/sand.jpg");
  beachTexture.wrapS = THREE.RepeatWrapping;
  beachTexture.wrapT = THREE.RepeatWrapping;
  beachTexture.repeat.set(700, 8);

  const beachGeometry = new THREE.PlaneGeometry(10000, 200);
  const beachMaterial = new THREE.MeshBasicMaterial({ map: beachTexture });
  const beach = new THREE.Mesh(beachGeometry, beachMaterial);
  beach.rotation.x = -Math.PI / 2;
  beach.position.z = -100;
  scene.add(beach);

  // house models
  House = new House();

  // tree models
  Tree = new Tree();

  // stairs model
  Stairs = new Stairs();

  // tower model
  Tower = new Tower();

  // boat model
  boat = new Boat();

  Island = new Island();

  // Add dat.GUI controls
  const gui = new dat.GUI();
  gui.add(boat, "m", 0, 100, 0.1).name("Mass");
  gui.add(boat, "g", 0, 20, 0.1).name("Gravity");
  gui.add(boat, "length", 0, 10, 0.1).name("Length");
  gui.add(boat, "width", 0, 5, 0.1).name("Width");
  gui.add(boat, "hight", 0, 2, 0.1).name("Height");
  gui.add(boat, "max_prop", 0, 20, 0.1).name("Max Propulsion");
  gui.add(boat, "min_prop", 0, 20, 0.1).name("Min Propulsion");
  gui.add(boat, "cd", 0, 1, 0.01).name("Drag Coefficient");
  gui.add(boat, "dt", 0, 0.1, 0.01).name("Time Step");
  gui.add(boat, 'max_rotation', -0.1, 0.6).name('Max Rotation Force');
  gui.add(boat, 'min_rotation', -0.1, 0.1).name('Min Rotation Force');
  gui.add(boat, 'waveAmplitude', 0, 1).name('Wave Amplitude');
  gui.add(boat, 'waveFrequency', 0, 1).name('Wave Frequency');
  gui.add(boat, 'waveSpeed', 0, 5).name('Wave Speed');
  gui.add(boat, 'collisionStrength', 1, 100).name('Collision Strength');
  gui.add(boat, 'collisionDamping', 0, 1).name('Collision Damping');
  gui.add(boat, 'windSpeed', 0, 10).name('Wind Speed');
gui.add(boat.windDirection, 'x', -1, 1, 0.01).name('Wind Direction X');
gui.add(boat.windDirection, 'y', -1, 1, 0.01).name('Wind Direction Y');
gui.add(boat.windDirection, 'z', -1, 1, 0.01).name('Wind Direction Z');

  window.addEventListener("resize", onWindowResize);window.addEventListener("keydown", function (e) {
    if (e.key === "ArrowUp") {
      boat.forword();
    }
    if (e.key === "ArrowDown") {
      boat.backword();
    }
    if (e.key === "ArrowRight") {
      boat.rotateLeft();
    }
    if (e.key === "ArrowLeft") {
      boat.rotateRight();
    
  }});

 window.addEventListener("keyup", function (e) {
  if (e.key === "ArrowUp"  ||e.key === "ArrowDown") {
    boat.stop();  // Stop propulsion when arrow up or down is released
  }
  if (e.key === "ArrowRight"  ||e.key === "ArrowLeft") {
    boat.rotationSpeed = 0;  // Stop rotation when arrow left or right is released
  }
});

  // Mouse down and up event listeners
  window.addEventListener("mousedown", () => {
    userInteracting = true;
    clearTimeout(interactionTimeout);
  });

  window.addEventListener("mouseup", () => {
    interactionTimeout = setTimeout(() => {
      userInteracting = false;
    });
  });
}

function isBoatVisible(boat) {
  // تحويل إحداثيات القارب إلى إحداثيات 2D على الشاشة
  const vector = new THREE.Vector3();
  const widthHalf = 0.5 * renderer.context.canvas.width;
  const heightHalf = 0.5 * renderer.context.canvas.height;

  boat.updateMatrixWorld();
  vector.setFromMatrixPosition(boat.matrixWorld);
  vector.project(camera);

  // تحويل الإحداثيات من [-1, 1] إلى [0, width] و [0, height]
  vector.x = (vector.x * widthHalf) + widthHalf;
  vector.y = -(vector.y * heightHalf) + heightHalf;

  // التحقق مما إذا كانت الإحداثيات ضمن حدود الشاشة
  return (
    vector.x >= 0 &&
    vector.x <= renderer.context.canvas.width &&
    vector.y >= 0 &&
    vector.y <= renderer.context.canvas.height
  );
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);
  render();
  boat.update();
}

function render() {
  water.material.uniforms["time"].value += 0.2 / 60.0;
  renderer.render(scene, camera);
}

function displayValues() {
  // Extract values from the boat object
  const pos = boat.pos;
  const v = boat.v;
  const acceleration = boat.calculat_a();
  const depth = boat.depth();
  const volume = boat.volum();
  const prop = boat.coreprop;

  // Display the values
  document.getElementById(
    "HTMLPosition"
  ).innerHTML = `<span>Position: </span> x: ${pos.x.toFixed(
    5
  )}, y: ${pos.y.toFixed(5)}, z: ${pos.z.toFixed(5)}`;
  document.getElementById(
    "HTMLVelocity"
  ).innerHTML = `<span>Velocity: </span> x: ${v.x.toFixed(5)}, y: ${v.y.toFixed(
    5
  )}, z: ${v.z.toFixed(5)}`;
  document.getElementById(
    "HTMLAcceleration"
  ).innerHTML = `<span>Acceleration: </span> x: ${acceleration.x.toFixed(
    5
  )}, y: ${acceleration.y.toFixed(5)}, z: ${acceleration.z.toFixed(5)}`;
  document.getElementById(
    "HTMLDepth"
  ).innerHTML = `<span>Depth: </span> ${depth.toFixed(5)}`;
  document.getElementById(
    "HTMLVolume"
  ).innerHTML = `<span>Volume: </span> ${volume.toFixed(5)}`;
  document.getElementById(
    "HTMLPropulsion"
  ).innerHTML = `<span>Propulsion: </span> ${prop.toFixed(5)}`;

  document.getElementById(
    "HTMLAccerlation"
  ).innerHTML = `<span>accesrelation: </span> x: ${accelerationview.x.toFixed(
    5
  )}, y: ${accelerationview.y.toFixed(5)}, z: ${accelerationview.z.toFixed(5)}`;
  // If you have other values to display, add them here in a similar way
  document.getElementById(
    "HTMLfric"
  ).innerHTML = `<span>fric: </span> x: ${ff.x.toFixed(5)}, y: ${ff.y.toFixed(
    5
  )}, z: ${ff.z.toFixed(5)}`;

  document.getElementById(
    "HTMLprop"
  ).innerHTML = `<span>prop: </span> x: ${propview.x.toFixed(
    5
  )}, y: ${propview.y.toFixed(5)}, z: ${propview.z.toFixed(5)}`;
}
