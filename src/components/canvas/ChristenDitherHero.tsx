"use client";

import React, { useEffect, useRef } from "react";

interface ChristenDitherHeroProps {
  className?: string;
  intro?: boolean;
}

export default function ChristenDitherHero({
  className = "",
  intro = true,
}: ChristenDitherHeroProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl", {
      antialias: false,
      alpha: false,
      powerPreference: "high-performance",
    });

    if (!gl) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const inkColor = [5 / 255, 5 / 255, 5 / 255];
    const paperColor = [242 / 255, 242 / 255, 238 / 255];

    let animId: number;
    let isVisible = true;
    let isDisposed = false;

    // Vertex & Fragment shaders directly from christendijoux.com
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
      uniform float uIntro;
      uniform float uCenter;
      uniform vec3 uFocus;
      uniform vec3 uInk;
      uniform vec3 uPaper;

      // --- Simplex noise 3D (Ashima Arts, MIT) ---
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

      // --- Bayer 8x8 without bitwise operators ---
      float bayer2(vec2 a){a=floor(a);return fract(a.x/2.0+a.y*a.y*0.75);}
      float bayer4(vec2 a){return bayer2(0.5*a)*0.25+bayer2(a);}
      float bayer8(vec2 a){return bayer4(0.5*a)*0.25+bayer2(a);}

      mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}

      float map(vec3 p){
        p.xz*=rot(uTime*0.12+uMouse.x*0.9);
        p.yz*=rot(uMouse.y*0.6-0.2);
        float n=snoise(p*1.25+vec3(0.0,0.0,uTime*0.18));
        n+=0.5*snoise(p*2.6-vec3(uTime*0.1));
        float radius=mix(0.08,0.62,uIntro)*(1.0-uScroll*0.3);
        return length(p)-radius-0.11*n*(0.6+uHover*0.7);
      }

      vec3 normalAt(vec3 p){
        const vec2 k=vec2(1.0,-1.0);
        const float h=0.0015;
        return normalize(k.xyy*map(p+k.xyy*h)+k.yyx*map(p+k.yyx*h)+k.yxy*map(p+k.yxy*h)+k.xxx*map(p+k.xxx*h));
      }

      void main(){
        vec2 frag=gl_FragCoord.xy;
        vec2 mousePx=(uMouse*0.5+0.5)*uRes;
        float dm=length(frag-mousePx)/uRes.y;
        // loupe : finer dither mesh near cursor
        float px=floor(uPixel*mix(0.34,1.0,smoothstep(0.04,0.22,dm/(0.4+uHover*0.6))));
        px=max(px,1.0);
        vec2 cell=floor(frag/px);
        vec2 c=(cell+0.5)*px;
        vec2 uv=(c-0.5*uRes)/min(uRes.x,uRes.y);

        // placement : right on large screens; centered on mobile
        float aspect=uRes.x/uRes.y;
        bool portrait=aspect<1.2;
        if(portrait&&uFocus.z>0.0&&uCenter<0.5){
          uv=(uv-uFocus.xy)*uFocus.z;
        }else if(portrait){
          uv.y-=0.2*(uRes.y/uRes.x)*(1.0-uCenter);
          uv*=mix(1.3,1.0,uCenter);
        }else{
          uv.x-=(0.5*aspect-0.62)*(1.0-uCenter);
          uv.y-=0.1*(1.0-uCenter);
        }
        uv.y+=uScroll*0.45;

        vec3 ro=vec3(0.0,0.0,3.1);
        vec3 rd=normalize(vec3(uv,-1.75));
        float t=0.0;
        float hit=0.0;
        for(int i=0;i<44;i++){
          vec3 p=ro+rd*t;
          float d=map(p);
          if(d<0.002){hit=1.0;break;}
          t+=d*0.9;
          if(t>6.0)break;
        }

        float lum;
        if(hit>0.5){
          vec3 p=ro+rd*t;
          vec3 n=normalAt(p);
          vec3 l=normalize(vec3(uMouse.x*1.4-0.6,uMouse.y*1.2+0.7,0.9));
          float diff=max(dot(n,l),0.0);
          float rim=pow(1.0-max(dot(n,-rd),0.0),3.0);
          float bands=0.08*sin(dot(p,vec3(9.0,7.0,5.0))+uTime*0.6);
          lum=0.03+diff*0.8+rim*0.3+bands;
        } else {
          // halo + starfield
          float r=length(uv);
          lum=max(0.0,0.14*exp(-r*2.2)-0.06);
          if(uFocus.z>0.0) lum*=0.35;
          float star=step(0.997,fract(sin(dot(cell,vec2(12.9898,78.233)))*43758.5453));
          lum+=star*0.6*(0.5+0.5*sin(uTime*2.0+cell.x));
        }
        lum*=(1.0-uScroll*0.55)*(portrait&&uCenter<0.5?0.85:1.0);

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

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;

    gl.useProgram(program);

    const isMobile =
      window.matchMedia("(max-width: 768px)").matches ||
      window.matchMedia("(hover: none)").matches;
    const dprScale = isMobile
      ? 1 / 4
      : Math.min(window.devicePixelRatio || 1, 1.75);

    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    if (isMobile) {
      canvas.style.imageRendering = "pixelated";
    }

    container.appendChild(canvas);

    // Fullscreen single triangle buffer (faster than quad)
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

    const getU = (name: string) => gl.getUniformLocation(program, name);
    const uMap = {
      uTime: getU("uTime"),
      uRes: getU("uRes"),
      uMouse: getU("uMouse"),
      uHover: getU("uHover"),
      uScroll: getU("uScroll"),
      uPixel: getU("uPixel"),
      uIntro: getU("uIntro"),
      uCenter: getU("uCenter"),
      uFocus: getU("uFocus"),
    };

    gl.uniform3fv(getU("uInk"), inkColor);
    gl.uniform3fv(getU("uPaper"), paperColor);

    const state = {
      uTime: 0,
      uRes: [1, 1],
      uMouse: [0.2, 0.1],
      uHover: 0,
      uScroll: 0,
      uPixel: isMobile ? 1 : 4 * dprScale,
      uIntro: 0,
      uCenter: 0,
      uFocus: [0, 0, 0],
    };

    const draw = () => {
      gl.uniform1f(uMap.uTime, state.uTime);
      gl.uniform2fv(uMap.uRes, state.uRes);
      gl.uniform2fv(uMap.uMouse, state.uMouse);
      gl.uniform1f(uMap.uHover, state.uHover);
      gl.uniform1f(uMap.uScroll, state.uScroll);
      gl.uniform1f(uMap.uPixel, state.uPixel);
      gl.uniform1f(uMap.uIntro, state.uIntro);
      gl.uniform1f(uMap.uCenter, state.uCenter);
      gl.uniform3fv(uMap.uFocus, state.uFocus);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const resize = () => {
      const { width, height } = container.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(width * dprScale));
      canvas.height = Math.max(1, Math.round(height * dprScale));
      gl.viewport(0, 0, canvas.width, canvas.height);
      state.uRes = [canvas.width, canvas.height];
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    const mouseTarget = [0.2, 0.1];
    let isHovering = 0;

    const handlePointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      mouseTarget[0] = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseTarget[1] = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      isHovering = 1;
    };

    const handlePointerLeave = () => {
      isHovering = 0;
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    document.addEventListener("pointerleave", handlePointerLeave);

    const observer = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting;
    });
    observer.observe(container);

    const getScroll = () =>
      Math.min(1, Math.max(0, window.scrollY / (container.offsetHeight || 1)));

    const startTime = performance.now();
    let lastDraw = 0;

    const render = (time: number) => {
      animId = requestAnimationFrame(render);
      if (!isVisible || isDisposed) return;

      // Throttle for mobile if needed
      if (isMobile && time - lastDraw < 32) return;
      lastDraw = time;

      state.uTime = prefersReducedMotion ? 4 : (time - startTime) / 1000;
      state.uMouse[0] += 0.06 * (mouseTarget[0] - state.uMouse[0]);
      state.uMouse[1] += 0.06 * (mouseTarget[1] - state.uMouse[1]);
      state.uHover += 0.04 * (isHovering - state.uHover);
      state.uIntro += 0.035 * ((intro ? 1 : 0) - state.uIntro);
      state.uScroll = getScroll();

      draw();
    };

    animId = requestAnimationFrame(render);

    return () => {
      isDisposed = true;
      cancelAnimationFrame(animId);
      window.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerleave", handlePointerLeave);
      ro.disconnect();
      observer.disconnect();
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      canvas.remove();
    };
  }, [intro]);

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 pointer-events-none select-none z-0 ${className}`}
      aria-hidden="true"
    />
  );
}
