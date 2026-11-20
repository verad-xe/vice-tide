// Vice Tide — keyboard and mouse state, read once per frame by main.js.
// Also exposes the "control" object that the screenshot autopilot writes to,
// so a scripted scene drives the exact same code path as a human player.

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;
    this.clicked = false;       // true for the single frame of a fresh click
    this.pressed = new Set();   // keys that went down this frame
    this.autopilot = null;      // optional function(game, control) for scenes

    window.addEventListener('keydown', (event) => {
      if (!event.repeat) {
        this.keys.add(event.code);
        this.pressed.add(event.code);
      }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
        event.preventDefault();
      }
    });
    window.addEventListener('keyup', (event) => this.keys.delete(event.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouseDown = false;
    });
    canvas.addEventListener('mousemove', (event) => {
      const rect = canvas.getBoundingClientRect();
      this.mouseX = event.clientX - rect.left;
      this.mouseY = event.clientY - rect.top;
    });
    canvas.addEventListener('mousedown', (event) => {
      if (event.button === 0) {
        this.mouseDown = true;
        this.clicked = true;
      }
    });
    window.addEventListener('mouseup', (event) => {
      if (event.button === 0) this.mouseDown = false;
    });
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  // Snapshot the controls for this frame. When an autopilot is installed it
  // fills the same fields, so gameplay code cannot tell the difference.
  read(game) {
    const control = {
      moveX: 0, moveY: 0, sprint: false,
      throttle: 0, steer: 0, brake: false, handbrake: false,
      aimScreenX: this.mouseX, aimScreenY: this.mouseY,
      shoot: this.mouseDown, clicked: this.clicked,
      enter: this.pressed.has('KeyE'),
      interact: this.pressed.has('KeyE') || this.pressed.has('KeyF'),
      reload: this.pressed.has('KeyR'),
      pause: this.pressed.has('Escape') || this.pressed.has('KeyP'),
      confirm: this.pressed.has('Enter') || this.pressed.has('Space'),
    };
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) control.moveX -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) control.moveX += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) control.moveY -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) control.moveY += 1;
    control.sprint = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    control.throttle = control.moveY < 0 ? 1 : 0;
    control.reverse = control.moveY > 0;
    control.steer = control.moveX;
    control.brake = control.moveY > 0;
    control.handbrake = this.keys.has('Space');
    if (this.autopilot) this.autopilot(game, control);
    return control;
  }

  // Call at the very end of a frame: one-shot signals last exactly one frame.
  endFrame() {
    this.pressed.clear();
    this.clicked = false;
  }
}
