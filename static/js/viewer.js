import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { PLYLoader } from "three/addons/loaders/PLYLoader.js";

const viewer = document.querySelector("#mesh-viewer");
const canvas = document.querySelector("#mesh-canvas");
const divider = document.querySelector("#viewer-divider");
const status = document.querySelector("#viewer-status");
const rotationButton = document.querySelector("#toggle-rotation");
const resetButton = document.querySelector("#reset-camera");

if (viewer && canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0xf2f5f9, 1);
  renderer.setScissorTest(true);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.001, 10000);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;

  const gtScene = createScene();
  const oursScene = createScene();
  const gtRoot = new THREE.Group();
  const oursRoot = new THREE.Group();
  gtScene.add(gtRoot);
  oursScene.add(oursRoot);

  let split = 0.5;
  let autoRotate = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let rotation = 0;
  let cameraHome = null;
  let targetHome = new THREE.Vector3();

  function createScene() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf2f5f9);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x5d6b82, 2.4));
    const key = new THREE.DirectionalLight(0xffffff, 3.1);
    key.position.set(4, 6, 5);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xaac8ff, 1.8);
    rim.position.set(-4, 2, -5);
    scene.add(rim);
    return scene;
  }

  function loadPly(url, root, color) {
    return new Promise((resolve, reject) => {
      new PLYLoader().load(
        url,
        (geometry) => {
          geometry.computeBoundingBox();
          const hasFaces = Boolean(geometry.index && geometry.index.count > 0);
          let object;
          if (hasFaces) {
            geometry.computeVertexNormals();
            object = new THREE.Mesh(
              geometry,
              new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.04, side: THREE.DoubleSide })
            );
          } else {
            object = new THREE.Points(
              geometry,
              new THREE.PointsMaterial({ color, size: 0.012, sizeAttenuation: true })
            );
          }
          root.add(object);
          resolve(object);
        },
        undefined,
        reject
      );
    });
  }

  function frameModels(objects) {
    const box = new THREE.Box3();
    objects.forEach((object) => box.expandByObject(object));
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const radius = Math.max(size.length() * 0.5, 0.1);

    gtRoot.position.copy(center).multiplyScalar(-1);
    oursRoot.position.copy(center).multiplyScalar(-1);
    targetHome.set(0, 0, 0);
    cameraHome = new THREE.Vector3(radius * 1.65, radius * 0.78, radius * 2.45);
    camera.position.copy(cameraHome);
    camera.near = Math.max(radius / 1000, 0.001);
    camera.far = radius * 100;
    camera.updateProjectionMatrix();
    controls.target.copy(targetHome);
    controls.update();
  }

  Promise.all([
    loadPly("static/models/gt.ply", gtRoot, 0xcbd5e1),
    loadPly("static/models/ours.ply", oursRoot, 0x78a7e8),
  ])
    .then((objects) => {
      frameModels(objects);
      status.textContent = "Demo meshes loaded — replace the two PLY files with your results";
      status.classList.add("ready");
    })
    .catch((error) => {
      console.error(error);
      status.textContent = "PLY loading failed. Check static/models/gt.ply and ours.ply.";
    });

  function setSplit(value) {
    split = Math.min(0.98, Math.max(0.02, value));
    const percent = split * 100;
    divider.style.left = `${percent}%`;
    divider.setAttribute("aria-valuenow", String(Math.round(percent)));
  }

  function updateFromPointer(event) {
    const rect = viewer.getBoundingClientRect();
    setSplit((event.clientX - rect.left) / rect.width);
  }

  divider.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    divider.setPointerCapture(event.pointerId);
    updateFromPointer(event);
  });
  divider.addEventListener("pointermove", (event) => {
    if (divider.hasPointerCapture(event.pointerId)) updateFromPointer(event);
  });
  divider.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") setSplit(split - 0.02);
    if (event.key === "ArrowRight") setSplit(split + 0.02);
  });

  rotationButton.addEventListener("click", () => {
    autoRotate = !autoRotate;
    rotationButton.textContent = autoRotate ? "Pause rotation" : "Resume rotation";
  });

  resetButton.addEventListener("click", () => {
    if (cameraHome) camera.position.copy(cameraHome);
    controls.target.copy(targetHome);
    controls.update();
  });

  controls.addEventListener("start", () => {
    autoRotate = false;
    rotationButton.textContent = "Resume rotation";
  });

  function resize() {
    const width = viewer.clientWidth;
    const height = viewer.clientHeight;
    const needsResize = canvas.width !== Math.floor(width * renderer.getPixelRatio()) || canvas.height !== Math.floor(height * renderer.getPixelRatio());
    if (needsResize) {
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }
  }

  function animate() {
    requestAnimationFrame(animate);
    resize();
    controls.update();
    if (autoRotate) rotation += 0.0042;
    gtRoot.rotation.y = rotation;
    oursRoot.rotation.y = rotation;

    const width = renderer.domElement.width;
    const height = renderer.domElement.height;
    const leftWidth = Math.round(width * split);
    renderer.setViewport(0, 0, width, height);

    renderer.setScissor(0, 0, leftWidth, height);
    renderer.render(gtScene, camera);

    renderer.setScissor(leftWidth, 0, width - leftWidth, height);
    renderer.render(oursScene, camera);
  }

  setSplit(0.5);
  animate();
}
