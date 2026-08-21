const Engine = Matter.Engine,
      Render = Matter.Render,
      World = Matter.World,
      Bodies = Matter.Bodies,
      Body = Matter.Body,
      Constraint = Matter.Constraint,
      Mouse = Matter.Mouse,
      MouseConstraint = Matter.MouseConstraint,
      Composite = Matter.Composite;

let engine, world, render, mouseConstraint;
let currentTool = 'select';
let selectedBody = null;
let isCreating = false;
let startPoint = null;
let isSimulationRunning = false;
let savedState = null;
let polygonPoints = [];
let drawingPolygon = false;
let resizeHandles = [];
let activeHandle = null;
let initialSize = null;

function init() {
  // Create engine and world
  engine = Engine.create();
  engine.timing.timeScale = 0; // Start paused
  world = engine.world;

  // Create renderer
  const canvas = document.getElementById('canvas');
  render = Render.create({
    canvas: canvas,
    engine: engine,
    options: {
      width: 800,
      height: 600,
      wireframes: false,
      background: '#ecf0f1',
      showDebug: true
    }
  });

  // Mouse control
  const mouse = Mouse.create(render.canvas);
  mouseConstraint = MouseConstraint.create(engine, {
    mouse: mouse,
    constraint: {
      stiffness: 0.2,
      render: {
        visible: false
      }
    }
  });

  World.add(world, mouseConstraint);

  // Setup event listeners
  setupEventListeners();
  
  // Add initial ground
  resetSimulation();

  // Start the engine
  Engine.run(engine);
  Render.run(render);

  // Add resize handles container
  const handlesContainer = document.createElement('div');
  handlesContainer.id = 'resize-handles';
  document.querySelector('.canvas-container').appendChild(handlesContainer);

  // Add event listeners for delete and resize tools
  document.getElementById('delete').addEventListener('click', () => {
    currentTool = 'delete';
    updateToolButtons();
  });
  
  document.getElementById('resize').addEventListener('click', () => {
    currentTool = 'resize';
    updateToolButtons();
    if (selectedBody) {
      showResizeHandles(selectedBody);
    }
  });
}

function setupEventListeners() {
  // Update the tools array to match the actual IDs in HTML
  const toolButtons = document.querySelectorAll('.tool-btn');
  toolButtons.forEach(button => {
    button.addEventListener('click', () => {
      currentTool = button.id;
      updateToolButtons();
    });
  });

  const playBtn = document.getElementById('play');
  const pauseBtn = document.getElementById('pause');
  const resetBtn = document.getElementById('reset');

  if (playBtn) playBtn.onclick = startSimulation;
  if (pauseBtn) pauseBtn.onclick = pauseSimulation;
  if (resetBtn) resetBtn.onclick = resetToSaved;

  render.canvas.addEventListener('mousedown', handleMouseDown);
  render.canvas.addEventListener('mousemove', handleMouseMove);
  render.canvas.addEventListener('mouseup', handleMouseUp);
}

function updateToolButtons() {
  const tools = document.querySelectorAll('.tool-btn');
  tools.forEach(btn => btn.classList.remove('active'));
  document.getElementById(currentTool)?.classList.add('active');
}

function startSimulation() {
  if (!isSimulationRunning) {
    saveState();
    engine.timing.timeScale = 1;
    isSimulationRunning = true;
    updateStatusIndicator('Running');
  }
}

function pauseSimulation() {
  engine.timing.timeScale = 0;
  isSimulationRunning = false;
  updateStatusIndicator('Paused');
}

function saveState() {
  // Only save if there are bodies to save
  const bodies = Composite.allBodies(world).filter(body => !body.isStatic);
  if (bodies.length > 0) {
    savedState = bodies.map(body => ({
      position: { ...body.position },
      velocity: { ...body.velocity },
      angle: body.angle,
      radius: body.circleRadius, // Save radius for circles
      width: body.bounds.max.x - body.bounds.min.x, // Save width for rectangles
      height: body.bounds.max.y - body.bounds.min.y, // Save height for rectangles
      type: body.circleRadius ? 'circle' : 'rectangle',
      properties: {
        mass: body.mass,
        restitution: body.restitution,
        friction: body.friction,
        isStatic: body.isStatic
      }
    }));
  }
}

function resetToSaved() {
  // Clear all non-static bodies
  const bodies = Composite.allBodies(world);
  bodies.forEach(body => {
    if (!body.isStatic) {
      World.remove(world, body);
    }
  });

  // Remove all constraints
  const constraints = Composite.allConstraints(world);
  constraints.forEach(constraint => {
    World.remove(world, constraint);
  });
  
  if (savedState && savedState.length > 0) {
    savedState.forEach(bodyState => {
      let body;
      if (bodyState.type === 'circle') {
        body = Bodies.circle(
          bodyState.position.x,
          bodyState.position.y,
          bodyState.radius,
          {
            ...bodyState.properties,
            angle: bodyState.angle,
            render: {
              fillStyle: '#2196F3'
            }
          }
        );
      } else {
        body = Bodies.rectangle(
          bodyState.position.x,
          bodyState.position.y,
          bodyState.width,
          bodyState.height,
          {
            ...bodyState.properties,
            angle: bodyState.angle,
            render: {
              fillStyle: '#4CAF50'
            }
          }
        );
      }
      World.add(world, body);
    });
  }
  
  pauseSimulation();
}

function updateStatusIndicator(status) {
  document.querySelector('.status-indicator').textContent = `Status: ${status}`;
}

function updatePropertyPanel(body) {
  if (!body) return;
  
  const properties = {
    mass: body.mass || 1,
    restitution: body.restitution || 0.5,
    friction: body.friction || 0.1,
    isStatic: body.isStatic || false,
    density: body.density || 0.001,
    frictionAir: body.frictionAir || 0.01
  };

  document.getElementById('mass').value = properties.mass;
  document.getElementById('elasticity').value = properties.restitution;
  document.getElementById('friction').value = properties.friction;
  document.getElementById('isStatic').checked = properties.isStatic;
  document.getElementById('density').value = properties.density;
  document.getElementById('airFriction').value = properties.frictionAir;

  // Add event listeners to update the selected body
  document.getElementById('mass').onchange = e => updateBodyProperty(body, 'mass', parseFloat(e.target.value));
  document.getElementById('elasticity').onchange = e => updateBodyProperty(body, 'restitution', parseFloat(e.target.value));
  document.getElementById('friction').onchange = e => updateBodyProperty(body, 'friction', parseFloat(e.target.value));
  document.getElementById('isStatic').onchange = e => updateBodyProperty(body, 'isStatic', e.target.checked);
  document.getElementById('density').onchange = e => updateBodyProperty(body, 'density', parseFloat(e.target.value));
  document.getElementById('airFriction').onchange = e => updateBodyProperty(body, 'frictionAir', parseFloat(e.target.value));

  showResizeHandles(body);
}

function updateBodyProperty(body, property, value) {
  if (!body) return;
  
  Body.set(body, property, value);
  
  if (property === 'isStatic') {
    body.isStatic = value;
    Matter.Sleeping.set(body, false);
  }
}

function showResizeHandles(body) {
  if (!body) return;
  
  // Remove existing handles
  const container = document.querySelector('.canvas-container');
  resizeHandles.forEach(handle => handle.remove());
  resizeHandles = [];

  const bounds = body.bounds;
  const positions = [
    { x: bounds.min.x, y: bounds.min.y }, // Top-left
    { x: bounds.max.x, y: bounds.min.y }, // Top-right
    { x: bounds.max.x, y: bounds.max.y }, // Bottom-right
    { x: bounds.min.x, y: bounds.max.y }  // Bottom-left
  ];

  positions.forEach((pos, index) => {
    const handle = document.createElement('div');
    handle.className = 'resize-handle';
    handle.style.left = `${pos.x}px`;
    handle.style.top = `${pos.y}px`;
    container.appendChild(handle);
    
    handle.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      activeHandle = { handle, index, body };
      initialSize = {
        width: bounds.max.x - bounds.min.x,
        height: bounds.max.y - bounds.min.y
      };
    });
    
    resizeHandles.push(handle);
  });

  document.addEventListener('mousemove', handleResize);
  document.addEventListener('mouseup', () => {
    activeHandle = null;
    initialSize = null;
  });
}

function handleResize(e) {
  if (!activeHandle) return;

  const { handle, index, body } = activeHandle;
  const rect = render.canvas.getBoundingClientRect();
  const mousePos = {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  };

  const bounds = body.bounds;
  const center = Matter.Vector.create(
    (bounds.min.x + bounds.max.x) / 2,
    (bounds.min.y + bounds.max.y) / 2
  );

  let newWidth = initialSize.width;
  let newHeight = initialSize.height;

  if (index === 0 || index === 3) { // Left handles
    newWidth = (bounds.max.x - mousePos.x);
  } else { // Right handles
    newWidth = (mousePos.x - bounds.min.x);
  }

  if (index === 0 || index === 1) { // Top handles
    newHeight = (bounds.max.y - mousePos.y);
  } else { // Bottom handles
    newHeight = (mousePos.y - bounds.min.y);
  }

  // Ensure minimum size
  newWidth = Math.max(20, newWidth);
  newHeight = Math.max(20, newHeight);

  if (body.circleRadius) {
    const newRadius = Math.min(newWidth, newHeight) / 2;
    Body.scale(body, newRadius / body.circleRadius, newRadius / body.circleRadius);
  } else {
    const scaleX = newWidth / initialSize.width;
    const scaleY = newHeight / initialSize.height;
    Body.scale(body, scaleX, scaleY);
  }

  showResizeHandles(body);
  
  if (body) {
    setTimeout(() => updatePropertyPanel(body), 0);
  }
}

function handleMouseDown(e) {
  // Get mouse position relative to canvas
  const rect = render.canvas.getBoundingClientRect();
  const point = {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  };

  if (currentTool === 'delete') {
    const bodies = Composite.allBodies(world);
    const clickedBody = bodies.find(body => Matter.Bounds.contains(body.bounds, point));
    
    if (clickedBody && !clickedBody.isStatic) {
      World.remove(world, clickedBody);
      selectedBody = null;
      resizeHandles.forEach(handle => handle.remove());
      resizeHandles = [];
    }
    return;
  }

  if (currentTool === 'resize' || currentTool === 'select') {
    const bodies = Composite.allBodies(world);
    selectedBody = bodies.find(body => Matter.Bounds.contains(body.bounds, point));
    if (selectedBody) {
      updatePropertyPanel(selectedBody);
      if (currentTool === 'resize') {
        showResizeHandles(selectedBody);
      }
    } else {
      resizeHandles.forEach(handle => handle.remove());
      resizeHandles = [];
    }
    return;
  }

  if (currentTool === 'polygon') {
    if (!drawingPolygon) {
      drawingPolygon = true;
      polygonPoints = [point];
    } else {
      const startPoint = polygonPoints[0];
      const distance = Math.hypot(point.x - startPoint.x, point.y - startPoint.y);
      
      if (distance < 20 && polygonPoints.length > 2) {
        createPolygon();
        drawingPolygon = false;
        polygonPoints = [];
      } else {
        polygonPoints.push(point);
      }
    }
    return;
  }

  startPoint = point;
  isCreating = true;

  // Clear previous preview
  const preview = document.querySelector('.shape-preview');
  preview.style.display = 'none';
  preview.innerHTML = '';
}

function handleMouseMove(e) {
  if (!isCreating && !drawingPolygon) return;
  
  const rect = render.canvas.getBoundingClientRect();
  const point = {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  };

  render.canvas.style.cursor = 'crosshair';
  
  const preview = document.querySelector('.shape-preview');
  preview.style.display = 'block';
  
  if (drawingPolygon) {
    updatePolygonPreview(preview, point);
  } else if (isCreating) {
    updateShapePreview(preview, point);
  }
}

function updatePolygonPreview(preview, currentPoint) {
  preview.innerHTML = `
    <svg width="100%" height="100%">
      ${createPolygonPath(currentPoint)}
      ${polygonPoints.map((pt, i) => 
        `<circle cx="${pt.x}" cy="${pt.y}" r="${i === 0 ? '4' : '3'}" 
         class="${i === 0 ? 'start-point-indicator' : ''}"/>`
      ).join('')}
    </svg>
  `;
}

function createPolygonPath(currentPoint) {
  const points = [...polygonPoints, currentPoint]
    .map(pt => `${pt.x},${pt.y}`)
    .join(' ');
  
  const closeDistance = polygonPoints.length > 2 ? 
    Math.hypot(currentPoint.x - polygonPoints[0].x, currentPoint.y - polygonPoints[0].y) : Infinity;

  return `
    <polyline class="polygon-outline" 
      points="${points} ${closeDistance < 20 ? polygonPoints[0].x+','+polygonPoints[0].y : ''}"/>
  `;
}

function updateShapePreview(preview, endPoint) {
  const start = startPoint;
  const minX = Math.min(start.x, endPoint.x);
  const minY = Math.min(start.y, endPoint.y);
  const width = Math.abs(endPoint.x - start.x);
  const height = Math.abs(endPoint.y - start.y);

  preview.style.left = `${minX}px`;
  preview.style.top = `${minY}px`;
  
  if (currentTool === 'rectangle') {
    preview.style.width = `${width}px`;
    preview.style.height = `${height}px`;
    preview.style.borderRadius = '0';
  } else if (currentTool === 'circle') {
    const diameter = Math.sqrt(width**2 + height**2);
    preview.style.width = `${diameter}px`;
    preview.style.height = `${diameter}px`;
    preview.style.borderRadius = '50%';
    preview.style.left = `${start.x - diameter/2}px`;
    preview.style.top = `${start.y - diameter/2}px`;
  }

  preview.style.borderStyle = currentTool === 'polygon' ? 'none' : 'solid';
}

function handleMouseUp(e) {
  if (!isCreating || !startPoint) return;

  const rect = render.canvas.getBoundingClientRect();
  const endPoint = {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  };

  createShape(startPoint, endPoint);
  
  isCreating = false;
  startPoint = null;
}

function createPolygon() {
  if (polygonPoints.length < 3) return;
  
  const vertices = polygonPoints.map(point => ({ x: point.x, y: point.y }));
  
  // Ensure the polygon is not self-intersecting
  if (!isPolygonSimple(vertices)) {
    console.warn('Cannot create self-intersecting polygon');
    return;
  }
  
  const body = Bodies.fromVertices(
    polygonPoints[0].x,
    polygonPoints[0].y,
    [vertices],
    {
      mass: parseFloat(document.getElementById('mass').value),
      restitution: parseFloat(document.getElementById('elasticity').value),
      friction: parseFloat(document.getElementById('friction').value),
      isStatic: document.getElementById('isStatic').checked,
      density: parseFloat(document.getElementById('density').value),
      frictionAir: parseFloat(document.getElementById('airFriction').value),
      render: {
        fillStyle: '#9b59b6',
        strokeStyle: '#8e44ad',
        lineWidth: 1
      }
    }
  );
  
  World.add(world, body);
}

function isPolygonSimple(vertices) {
  // Check for self-intersections
  for (let i = 0; i < vertices.length; i++) {
    const a1 = vertices[i];
    const a2 = vertices[(i + 1) % vertices.length];
    
    for (let j = i + 2; j < vertices.length; j++) {
      const b1 = vertices[j];
      const b2 = vertices[(j + 1) % vertices.length];
      
      if (linesIntersect(a1, a2, b1, b2)) {
        return false;
      }
    }
  }
  return true;
}

function linesIntersect(a1, a2, b1, b2) {
  const det = (a2.x - a1.x) * (b2.y - b1.y) - (b2.x - b1.x) * (a2.y - a1.y);
  if (det === 0) return false;
  
  const lambda = ((b2.y - b1.y) * (b2.x - a1.x) + (b1.x - b2.x) * (b2.y - a1.y)) / det;
  const gamma = ((a1.y - a2.y) * (b2.x - a1.x) + (a2.x - a1.x) * (b2.y - a1.y)) / det;
  
  return (0 < lambda && lambda < 1) && (0 < gamma && gamma < 1);
}

function createShape(start, end) {
  const width = Math.abs(end.x - start.x);
  const height = Math.abs(end.y - start.y);
  const x = Math.min(start.x, end.x) + width/2;
  const y = Math.min(start.y, end.y) + height/2;

  let body;

  switch(currentTool) {
    case 'rectangle':
      body = Bodies.rectangle(x, y, width, height, {
        mass: parseFloat(document.getElementById('mass').value),
        restitution: parseFloat(document.getElementById('elasticity').value),
        friction: parseFloat(document.getElementById('friction').value),
        render: {
          fillStyle: '#4CAF50'
        }
      });
      World.add(world, body);
      break;

    case 'circle':
      const radius = Math.sqrt(width * width + height * height) / 2;
      body = Bodies.circle(start.x, start.y, radius, {
        mass: parseFloat(document.getElementById('mass').value),
        restitution: parseFloat(document.getElementById('elasticity').value),
        friction: parseFloat(document.getElementById('friction').value),
        render: {
          fillStyle: '#2196F3'
        }
      });
      World.add(world, body);
      break;

    case 'spring':
      if (selectedBody) {
        const constraint = Constraint.create({
          bodyA: selectedBody,
          pointB: { x: end.x, y: end.y },
          stiffness: 0.01,
          damping: 0.1,
          render: {
            visible: true,
            lineWidth: 2,
            strokeStyle: '#FFC107'
          }
        });
        World.add(world, constraint);
        selectedBody = null;
      }
      break;

    case 'pin':
      if (selectedBody) {
        const constraint = Constraint.create({
          bodyA: selectedBody,
          pointB: { x: end.x, y: end.y },
          length: 0,
          stiffness: 1,
          render: {
            visible: true,
            lineWidth: 2,
            strokeStyle: '#FF5722'
          }
        });
        World.add(world, constraint);
        selectedBody = null;
      }
      break;

    case 'rope':
      if (selectedBody) {
        const constraint = Constraint.create({
          bodyA: selectedBody,
          pointB: { x: end.x, y: end.y },
          length: 100,
          stiffness: 0.1,
          render: {
            type: 'line',
            strokeStyle: '#95a5a6'
          }
        });
        World.add(world, constraint);
        selectedBody = null;
      }
      break;

    case 'force' || 'thruster':
      if (selectedBody) {
        const magnitude = parseFloat(document.getElementById('forceMagnitude').value);
        const force = {
          x: (end.x - start.x) * magnitude,
          y: (end.y - start.y) * magnitude
        };
        Body.applyForce(selectedBody, start, force);
      }
      break;
  }
}

function resetSimulation() {
  World.clear(world);
  
  // Add ground
  const ground = Bodies.rectangle(400, 590, 810, 20, {
    isStatic: true,
    render: {
      fillStyle: '#2c3e50'
    }
  });
  
  // Add walls
  const leftWall = Bodies.rectangle(0, 300, 20, 600, {
    isStatic: true,
    render: { fillStyle: '#2c3e50' }
  });
  
  const rightWall = Bodies.rectangle(800, 300, 20, 600, {
    isStatic: true,
    render: { fillStyle: '#2c3e50' }
  });
  
  const ceiling = Bodies.rectangle(400, 0, 810, 20, {
    isStatic: true,
    render: { fillStyle: '#2c3e50' }
  });
  
  World.add(world, [ground, leftWall, rightWall, ceiling]);
  savedState = null;
  pauseSimulation();
}

init();