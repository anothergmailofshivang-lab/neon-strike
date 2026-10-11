import * as THREE from 'three';
import type { GameConfig } from '../app/GameConfig';

export interface RendererStats {
  width: number;
  height: number;
  pixelRatio: number;
  drawCalls: number | null;
  geometries: number | null;
  textures: number | null;
}

export class Renderer {
  private readonly container: HTMLElement;
  private readonly config: GameConfig;
  private readonly renderer: THREE.WebGLRenderer;
  private disposed = false;
  private width = 0;
  private height = 0;

  public constructor(container: HTMLElement, config: GameConfig) {
    this.container = container;
    this.config = config;

    try {
      this.renderer = new THREE.WebGLRenderer({
        antialias: config.renderer.antialias,
        alpha: false,
        powerPreference: config.renderer.powerPreference,
      });
    } catch (error) {
      throw new Error(
        `WebGL renderer initialization failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    this.renderer.setPixelRatio(this.getPixelRatio());
    this.renderer.setClearColor(config.renderer.backgroundColor, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.domElement.className = 'game-canvas';
    this.renderer.domElement.setAttribute('aria-label', 'NEON STRIKE 3D practice arena');
    this.container.appendChild(this.renderer.domElement);
  }

  public get canvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  public resize(width: number, height: number, camera: THREE.PerspectiveCamera): boolean {
    if (this.disposed) {
      return false;
    }

    const safeWidth = Number.isFinite(width) && width > 0 ? Math.floor(width) : 1;
    const safeHeight = Number.isFinite(height) && height > 0 ? Math.floor(height) : 1;
    if (safeWidth === this.width && safeHeight === this.height) {
      return false;
    }

    this.width = safeWidth;
    this.height = safeHeight;
    this.renderer.setPixelRatio(this.getPixelRatio());
    this.renderer.setSize(safeWidth, safeHeight, false);
    camera.aspect = safeWidth / safeHeight;
    camera.updateProjectionMatrix();
    return true;
  }

  public render(scene: THREE.Scene, camera: THREE.PerspectiveCamera): void {
    if (!this.disposed) {
      this.renderer.render(scene, camera);
    }
  }

  public renderPreview(scene: THREE.Scene, camera: THREE.PerspectiveCamera, bounds: DOMRect): void {
    if (this.disposed) return;
    const canvas = this.canvas.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;
    const pixelRatio = this.getPixelRatio();
    const left = bounds.left - canvas.left;
    const bottom = canvas.bottom - bounds.bottom;
    this.renderer.setViewport(left * pixelRatio, bottom * pixelRatio, bounds.width * pixelRatio, bounds.height * pixelRatio);
    this.renderer.setScissor(left * pixelRatio, bottom * pixelRatio, bounds.width * pixelRatio, bounds.height * pixelRatio);
    this.renderer.setScissorTest(true);
    this.renderer.clear(true, true, true);
    this.renderer.render(scene, camera);
    this.renderer.setScissorTest(false);
    this.renderer.setViewport(0, 0, this.width, this.height);
  }

  public getStats(): RendererStats {
    const info = this.renderer.info;
    return {
      width: this.width,
      height: this.height,
      pixelRatio: this.getPixelRatio(),
      drawCalls: Number.isFinite(info.render.calls) ? info.render.calls : null,
      geometries: Number.isFinite(info.memory.geometries) ? info.memory.geometries : null,
      textures: Number.isFinite(info.memory.textures) ? info.memory.textures : null,
    };
  }

  public dispose(removeCanvas = true): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.renderer.dispose();
    if (removeCanvas && this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }

  private getPixelRatio(): number {
    const devicePixelRatio = typeof window === 'undefined' ? 1 : window.devicePixelRatio;
    return Math.min(Math.max(devicePixelRatio || 1, 1), this.config.renderer.maxPixelRatio);
  }
}
