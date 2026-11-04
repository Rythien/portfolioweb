"use client";

import React, { useEffect, useRef } from "react";

interface DitherHeroProps {
  className?: string;
}

export default function DitherHero({ className = "" }: DitherHeroProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // Fallback static renderer for reduced motion or no WebGL
    const renderFallbackStatic = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 300;
      canvas.height = 300;
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.opacity = "0.2";
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#050505";
        ctx.fillRect(0, 0, 300, 300);
        ctx.fillStyle = "#edebe6";
        for (let x = 0; x < 300; x += 6) {
          for (let y = 0; y < 300; y += 6) {
            const dist = Math.hypot(x - 150, y - 150);
            if (dist < 120 && Math.random() > dist / 120) {
              ctx.fillRect(x, y, 2, 2);
            }
          }
        }
      }
      container.appendChild(canvas);
    };

    if (prefersReducedMotion) {
      renderFallbackStatic();
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";

    const gl = canvas.getContext("webgl", {
      antialias: false,
      alpha: false,
      powerPreference: "high-performance",
    });

    if (!gl) {
      renderFallbackStatic();
      return;
    }

    container.appendChild(canvas);

    // KHR_parallel_shader_compile extension check
    const parallelCompileExt = gl.getExtension("KHR_parallel_shader_compile");
    void parallelCompileExt;

    const vsSource = `
      attribute vec2 position;
      void main() {
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `;

    const fsSource = `
      precision highp float;
      uniform float uTime;
      uniform vec2 uRes;
      uniform vec2 uMouse;
      uniform float uHover;
      uniform float uScroll;
      uniform float uPixel;
      uniform vec3 uInk;
      uniform vec3 uPaper;

      // Ashima Arts 3D Simplex Noise
      vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
      vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
      vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
      vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}

      float snoise(vec3 v){
        const vec2 C=vec2(1.0/6.0,1.0/3.0);
        const vec4 D=vec4(0.0,0.5,1.0,2.0);
        vec3 i=floor(v+dot(v,C.yyy));
        vec3 x0=v-i+dot(i,C.xxx);
        vec3 g=step(x0.yzx,x0.xyz);
        vec3 l=1.0-g;
        vec3 i1=min(g.xyz,l.zxy);
        vec3 i2=max(g.xyz,l.zxy);
        vec3 x1=x0-i1+C.xxx;
        vec3 x2=x0-i2+C.yyy;
        vec3 x3=x0-D.yyy;
        i=mod289(i);
        vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
        float n_=0.142857142857;
        vec3 ns=n_*D.wyz-D.xzx;
        vec4 j=p-49.0*floor(p*ns.z*ns.z);
        vec4 x_=floor(j*ns.z);
        vec4 y_=floor(j-7.0*x_);
        vec4 x=x_*ns.x+ns.yyyy;
        vec4 y=y_*ns.x+ns.yyyy;
        vec4 h=1.0-abs(x)-abs(y);
        vec4 b0=vec4(x.xy,y.xy);
        vec4 b1=vec4(x.zw,y.zw);
        vec4 s0=floor(b0)*2.0+1.0;
        vec4 s1=floor(b1)*2.0+1.0;
        vec4 sh=-step(h,vec4(0.0));
        vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
        vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
        vec3 p0=vec3(a0.xy,h.x);
        vec3 p1=vec3(a0.zw,h.y);
        vec3 p2=vec3(a1.xy,h.z);
        vec3 p3=vec3(a1.zw,h.w);
        vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
        p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
        vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
        m=m*m;
        return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
      }

      // 8x8 Bayer Ordered Dither
      float bayer2(vec2 a){a=floor(a);return fract(a.x/2.0+a.y*a.y*0.75);}
      float bayer4(vec2 a){return bayer2(0.5*a)*0.25+bayer2(a);}
      float bayer8(vec2 a){return bayer4(0.5*a)*0.25+bayer2(a);}

      mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}

      float map(vec3 p){
        p.xz*=rot(uTime*0.08+uMouse.x*0.7);
        p.yz*=rot(uMouse.y*0.5-0.1);
        float n=snoise(p*1.2+vec3(0.0,0.0,uTime*0.14));
        n+=0.4*snoise(p*2.4-vec3(uTime*0.08));
        float radius=0.62*(1.0-uScroll*0.45);
        return length(p)-radius-0.12*n*(0.7+uHover*0.8);
      }

      vec3 normalAt(vec3 p){
        const vec2 k=vec2(1.0,-1.0);
        const float h=0.002;
        return normalize(k.xyy*map(p+k.xyy*h)+k.yyx*map(p+k.yyx*h)+k.yxy*map(p+k.yxy*h)+k.xxx*map(p+k.xxx*h));
      }

      void main(){
        vec2 frag=gl_FragCoord.xy;
        vec2 mousePx=(uMouse*0.5+0.5)*uRes;
        float dm=length(frag-mousePx)/uRes.y;
        
        // Loupe magnifier: finer dither cell near cursor pointer
        float px=floor(uPixel*mix(0.35, 1.0, smoothstep(0.04, 0.24, dm/(0.4+uHover*0.6))));
        px=max(px, 1.0);
        vec2 cell=floor(frag/px);
        vec2 c=(cell+0.5)*px;
        vec2 uv=(c-0.5*uRes)/min(uRes.x,uRes.y);

        float aspect=uRes.x/uRes.y;
        if(aspect>1.15){
          uv.x-=(0.5*aspect-0.55);
        } else {
          uv.y-=0.12;
        }
        uv.y+=uScroll*0.4;

        vec3 ro=vec3(0.0,0.0,3.0);
        vec3 rd=normalize(vec3(uv,-1.7));
        float t=0.0;
        float hit=0.0;
        for(int i=0;i<40;i++){
          vec3 p=ro+rd*t;
          float d=map(p);
          if(d<0.0025){hit=1.0;break;}
          t+=d*0.9;
          if(t>5.5)break;
        }

        float lum=0.0;
        if(hit>0.5){
          vec3 p=ro+rd*t;
          vec3 n=normalAt(p);
          vec3 l=normalize(vec3(uMouse.x*1.2-0.5,uMouse.y*1.2+0.8,0.9));
          float diff=max(dot(n,l),0.0);
          float rim=pow(1.0-max(dot(n,-rd),0.0),3.0);
          float bands=0.07*sin(dot(p,vec3(8.0,6.0,5.0))+uTime*0.5);
          lum=0.04+diff*0.75+rim*0.35+bands;
        } else {
          float r=length(uv);
          lum=max(0.0,0.12*exp(-r*2.0)-0.05);
          float star=step(0.9975,fract(sin(dot(cell,vec2(12.9898,78.233)))*43758.5453));
          lum+=star*0.5*(0.5+0.5*sin(uTime*1.8+cell.x));
        }

        lum*=(1.0-uScroll*0.7);

        float threshold=bayer8(cell);
        float on=step(threshold,clamp(lum,0.0,1.0)*0.98);
        gl_FragColor=vec4(mix(uInk,uPaper,on),1.0);
      }
    `;

    const createShader = (type: number, src: string) => {
      const s = gl.createShader(type);
      if (!s) return null;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };

    const vs = createShader(gl.VERTEX_SHADER, vsSource);
    const fs = createShader(gl.FRAGMENT_SHADER, fsSource);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn("DitherHero program link failure");
      return;
    }

    gl.useProgram(program);

    // Full-screen single triangle buffer
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW
    );

    const posAttr = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(posAttr);
    gl.vertexAttribPointer(posAttr, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(program, "uTime");
    const uRes = gl.getUniformLocation(program, "uRes");
    const uMouse = gl.getUniformLocation(program, "uMouse");
    const uHover = gl.getUniformLocation(program, "uHover");
    const uScroll = gl.getUniformLocation(program, "uScroll");
    const uPixel = gl.getUniformLocation(program, "uPixel");
    const uInk = gl.getUniformLocation(program, "uInk");
    const uPaper = gl.getUniformLocation(program, "uPaper");

    // Pure two-tone #050505 and #edebe6
    gl.uniform3f(uInk, 5 / 255, 5 / 255, 5 / 255);
    gl.uniform3f(uPaper, 237 / 255, 235 / 255, 230 / 255);

    const mouse = { x: 0, y: 0 };
    const targetMouse = { x: 0, y: 0 };
    let hover = 0;
    let targetHover = 0;
    let isVisible = true;
    let animId: number;
    let dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let consecutiveSlowFrames = 0;

    const resize = () => {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uPixel, Math.max(3.0 * dpr, 2.0));
    };

    resize();
    window.addEventListener("resize", resize, { passive: true });

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      targetMouse.x = x;
      targetMouse.y = y;
      targetHover = 1.0;
    };

    const handleMouseLeave = () => {
      targetHover = 0.0;
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    container.addEventListener("mouseleave", handleMouseLeave, { passive: true });

    // Pause when off-screen
    const observer = new IntersectionObserver((entries) => {
      isVisible = entries[0]?.isIntersecting ?? false;
    });
    observer.observe(container);

    const startTime = performance.now();
    let lastFrameTime = performance.now();

    const render = (now: number) => {
      const delta = now - lastFrameTime;
      lastFrameTime = now;

      // Automatic low-power mode adjustment keyed to GPU frame budget
      if (delta > 22) {
        consecutiveSlowFrames++;
        if (consecutiveSlowFrames > 8 && dpr > 0.75) {
          dpr = 0.75;
          resize();
        }
      } else {
        consecutiveSlowFrames = Math.max(0, consecutiveSlowFrames - 1);
      }

      if (isVisible) {
        const time = (now - startTime) * 0.001;

        // Smooth mouse & hover interpolation
        mouse.x += (targetMouse.x - mouse.x) * 0.08;
        mouse.y += (targetMouse.y - mouse.y) * 0.08;
        hover += (targetHover - hover) * 0.06;

        const scrollFraction = Math.min(
          1.0,
          window.scrollY / (window.innerHeight * 0.9)
        );

        gl.uniform1f(uTime, time);
        gl.uniform2f(uMouse, mouse.x, mouse.y);
        gl.uniform1f(uHover, hover);
        gl.uniform1f(uScroll, scrollFraction);

        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouseMove);
      container.removeEventListener("mouseleave", handleMouseLeave);
      observer.disconnect();
      if (gl) {
        gl.deleteProgram(program);
        gl.deleteShader(vs);
        gl.deleteShader(fs);
        gl.deleteBuffer(buffer);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={`absolute inset-0 pointer-events-none overflow-hidden select-none ${className}`}
    />
  );
}
