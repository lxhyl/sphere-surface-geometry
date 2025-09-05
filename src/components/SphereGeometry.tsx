import React, { useRef, useState, useCallback } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Sphere, Text } from '@react-three/drei';
import * as THREE from 'three';

interface Marker {
  id: string;
  position: THREE.Vector3;
  index: number;
}

interface GeodesicLine {
  id: string;
  start: THREE.Vector3;
  end: THREE.Vector3;
  points: THREE.Vector3[];
}

interface AngleInfo {
  vertex: THREE.Vector3;
  angle: number;
  label: string;
}

// 球体组件
function InteractiveSphere({ 
  markers, 
  geodesicLines, 
  onMarkerClick,
  angleInfo,
  showPlanarProjection,
  projectToPlane
}: {
  markers: Marker[];
  geodesicLines: GeodesicLine[];
  onMarkerClick: (position: THREE.Vector3) => void;
  angleInfo: AngleInfo[];
  showPlanarProjection: boolean;
  projectToPlane: (point: THREE.Vector3) => THREE.Vector3;
}) {
  const sphereRef = useRef<THREE.Mesh>(null);
  const { camera, raycaster, mouse } = useThree();

  // 处理鼠标点击
  const handleClick = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    
    // 更新鼠标位置
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // 射线投射
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(sphereRef.current!);

    if (intersects.length > 0) {
      const point = intersects[0].point;
      onMarkerClick(point);
    }
  }, [camera, mouse, raycaster, onMarkerClick]);

  return (
    <group>
      {/* 球体 */}
      <Sphere
        ref={sphereRef}
        args={[1, 32, 32]}
        onClick={handleClick}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'auto';
        }}
      >
        <meshStandardMaterial color="#4A90E2" wireframe={false} />
      </Sphere>

      {/* 经纬线网格 - 赤道朝向用户 */}
      <group>
        {/* 经线 (子午线) - 从北极到南极的垂直线，绕Y轴旋转 */}
        {Array.from({ length: 12 }, (_, i) => {
          const longitude = (i * 2 * Math.PI) / 12; // 每30度一条经线
          const points: THREE.Vector3[] = [];
          
          // 从北极到南极创建经线点，调整坐标系让赤道朝向用户
          for (let lat = -Math.PI/2; lat <= Math.PI/2; lat += Math.PI/32) {
            // 标准球面坐标
            const x = Math.cos(lat) * Math.cos(longitude);
            const y = Math.sin(lat); // Y轴是南北方向
            const z = Math.cos(lat) * Math.sin(longitude);
            points.push(new THREE.Vector3(x, y, z));
          }
          
          const geometry = new THREE.BufferGeometry().setFromPoints(points);
          return (
            <primitive 
              key={`meridian-${i}`}
              object={new THREE.Line(
                geometry, 
                new THREE.LineBasicMaterial({ 
                  color: '#E8F4FD', 
                  transparent: true,
                  opacity: 0.3,
                  linewidth: 1
                })
              )} 
            />
          );
        })}

        {/* 纬线 (平行线) - 水平圆圈，绕Y轴旋转 */}
        {Array.from({ length: 7 }, (_, i) => {
          const latitude = -Math.PI/2 + (i + 1) * Math.PI/8; // 跳过极地，每22.5度一条纬线
          const radius = Math.cos(latitude);
          const y = Math.sin(latitude);
          const points: THREE.Vector3[] = [];
          
          // 创建纬线圆圈，调整坐标系
          for (let lon = 0; lon <= 2 * Math.PI; lon += Math.PI/32) {
            const x = radius * Math.cos(lon);
            const z = radius * Math.sin(lon);
            points.push(new THREE.Vector3(x, y, z));
          }
          
          const geometry = new THREE.BufferGeometry().setFromPoints(points);
          return (
            <primitive 
              key={`parallel-${i}`}
              object={new THREE.Line(
                geometry, 
                new THREE.LineBasicMaterial({ 
                  color: '#E8F4FD', 
                  transparent: true,
                  opacity: 0.3,
                  linewidth: 1
                })
              )} 
            />
          );
        })}
      </group>

      {/* 标记点 */}
      {markers.map((marker) => (
        <Sphere key={marker.id} args={[0.02, 8, 8]} position={marker.position}>
          <meshStandardMaterial color="#FF6B6B" />
        </Sphere>
      ))}

      {/* 标记点标签 */}
      {markers.map((marker) => (
        <Text
          key={`label-${marker.id}`}
          position={[marker.position.x * 1.1, marker.position.y * 1.1, marker.position.z * 1.1]}
          fontSize={0.05}
          color="#333"
          anchorX="center"
          anchorY="middle"
        >
          {marker.index + 1}
        </Text>
      ))}

      {/* 测地线 */}
      {geodesicLines.map((line) => (
        <group key={line.id}>
          {line.points.map((point, index) => {
            if (index === 0) return null;
            const prevPoint = line.points[index - 1];
            
            // 将测地线点稍微向外偏移，避免被球体遮挡
            const offset = 1.01; // 向外偏移1%
            const offsetPrevPoint = prevPoint.clone().multiplyScalar(offset);
            const offsetPoint = point.clone().multiplyScalar(offset);
            
            const geometry = new THREE.BufferGeometry().setFromPoints([offsetPrevPoint, offsetPoint]);
            return (
              <primitive 
                key={`${line.id}-${index}`} 
                object={new THREE.Line(
                  geometry, 
                  new THREE.LineBasicMaterial({ 
                    color: '#FFD93D', 
                    linewidth: 4,
                    transparent: false,
                    opacity: 1.0
                  })
                )} 
              />
            );
          })}
        </group>
      ))}

      {/* 角度标签 */}
      {angleInfo.map((angle, index) => (
        <Text
          key={`angle-${index}`}
          position={[angle.vertex.x * 1.2, angle.vertex.y * 1.2, angle.vertex.z * 1.2]}
          fontSize={0.04}
          color="#E74C3C"
          anchorX="center"
          anchorY="middle"
        >
          {angle.label}
        </Text>
      ))}

      {/* 平面投影 */}
      {showPlanarProjection && markers.length >= 3 && (
        <group>
          {/* 投影平面 */}
          <mesh position={[0, 0, -2]}>
            <planeGeometry args={[6, 6]} />
            <meshBasicMaterial color="#E8F4FD" transparent opacity={0.2} />
          </mesh>
          
          {/* 投影点 */}
          {markers.map((marker) => {
            const projectedPos = projectToPlane(marker.position);
            return (
              <Sphere key={`projected-${marker.id}`} args={[0.03, 8, 8]} position={projectedPos}>
                <meshStandardMaterial color="#3498DB" />
              </Sphere>
            );
          })}
          
          {/* 投影点标签 */}
          {markers.map((marker) => {
            const projectedPos = projectToPlane(marker.position);
            projectedPos.z = -1.9; // 稍微在平面上方
            return (
              <Text
                key={`projected-label-${marker.id}`}
                position={[projectedPos.x * 1.1, projectedPos.y * 1.1, projectedPos.z]}
                fontSize={0.05}
                color="#2C3E50"
                anchorX="center"
                anchorY="middle"
              >
                {marker.index + 1}
              </Text>
            );
          })}
          
          {/* 投影多边形连线 */}
          {markers.map((marker, index) => {
            const nextMarker = markers[(index + 1) % markers.length];
            const startPos = projectToPlane(marker.position);
            const endPos = projectToPlane(nextMarker.position);
            
            const geometry = new THREE.BufferGeometry().setFromPoints([startPos, endPos]);
            return (
              <primitive 
                key={`projected-line-${index}`} 
                object={new THREE.Line(
                  geometry, 
                  new THREE.LineBasicMaterial({ 
                    color: '#3498DB', 
                    linewidth: 3,
                    transparent: false,
                    opacity: 1.0
                  })
                )} 
              />
            );
          })}
        </group>
      )}
    </group>
  );
}

// 主组件
export default function SphereGeometry() {
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [geodesicLines, setGeodesicLines] = useState<GeodesicLine[]>([]);
  const [angleInfo, setAngleInfo] = useState<AngleInfo[]>([]);
  const [planarAngleInfo, setPlanarAngleInfo] = useState<AngleInfo[]>([]);
  const [showPlanarProjection] = useState(true);

  // 将球面点投影到平面
  const projectToPlane = (sphericalPoint: THREE.Vector3): THREE.Vector3 => {
    // 使用简单的正交投影，将球面点投影到z=0的平面
    // 并适当缩放以使其更清晰可见
    const scale = 2.5; // 放大投影点
    
    const projectedPoint = new THREE.Vector3(
      sphericalPoint.x * scale,
      sphericalPoint.y * scale,
      -2 // 投影到z=-2平面
    );
    
    return projectedPoint;
  };

  // 计算球面测地线（大圆弧）
  const calculateGeodesic = (start: THREE.Vector3, end: THREE.Vector3): THREE.Vector3[] => {
    const points: THREE.Vector3[] = [];
    const segments = 30;
    
    // 计算两个点之间的角度
    const angle = Math.acos(Math.max(-1, Math.min(1, start.dot(end))));
    
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const sinAngle = Math.sin(angle);
      const sinT = Math.sin(t * angle);
      const sin1MinusT = Math.sin((1 - t) * angle);
      
      const point = new THREE.Vector3(
        (start.x * sin1MinusT + end.x * sinT) / sinAngle,
        (start.y * sin1MinusT + end.y * sinT) / sinAngle,
        (start.z * sin1MinusT + end.z * sinT) / sinAngle
      );
      
      points.push(point);
    }
    
    return points;
  };


  // 球面凸包算法 - 使用基于极坐标的简单排序
  const calculateSphericalConvexHull = (markers: Marker[]): Marker[] => {
    if (markers.length < 3) return markers;
    if (markers.length === 3) return markers;

    // 对于4个或更多点，使用基于极坐标的排序
    const points = [...markers];
    
    // 计算每个点的极坐标
    const pointsWithCoords = points.map(marker => {
      const pos = marker.position.clone();
      const phi = Math.acos(Math.max(-1, Math.min(1, pos.z))); // 极角 (0 to π)
      const theta = Math.atan2(pos.y, pos.x); // 方位角 (-π to π)
      
      return {
        marker,
        phi,
        theta
      };
    });
    
    // 按方位角排序，但处理跨越-π/π边界的情况
    pointsWithCoords.sort((a, b) => {
      // 处理角度跨越边界的情况
      let angleA = a.theta;
      let angleB = b.theta;
      
      // 如果角度差大于π，调整较小的角度
      if (Math.abs(angleA - angleB) > Math.PI) {
        if (angleA < angleB) {
          angleA += 2 * Math.PI;
        } else {
          angleB += 2 * Math.PI;
        }
      }
      
      return angleA - angleB;
    });
    
    // 返回排序后的标记点
    return pointsWithCoords.map(p => p.marker);
  };

  // 计算平面多边形的内角和
  const calculatePlanarAngles = (markers: Marker[]): AngleInfo[] => {
    if (markers.length < 3) return [];

    const angles: AngleInfo[] = [];
    
    for (let i = 0; i < markers.length; i++) {
      const prev = markers[(i - 1 + markers.length) % markers.length];
      const current = markers[i];
      const next = markers[(i + 1) % markers.length];

      // 计算平面三角形的角度
      // 使用平面余弦定理
      const a = prev.position.distanceTo(current.position);
      const b = current.position.distanceTo(next.position);
      const c = next.position.distanceTo(prev.position);
      
      // 平面余弦定理计算角度
      const cosA = (a * a + b * b - c * c) / (2 * a * b);
      const angle = Math.acos(Math.max(-1, Math.min(1, cosA))) * 180 / Math.PI;

      angles.push({
        vertex: current.position,
        angle: angle,
        label: `${angle.toFixed(1)}°`
      });
    }

    return angles;
  };

  // 计算球面多边形的角度
  const calculateSphericalAngles = (markers: Marker[]): AngleInfo[] => {
    if (markers.length < 3) return [];

    const angles: AngleInfo[] = [];
    
    for (let i = 0; i < markers.length; i++) {
      const prev = markers[(i - 1 + markers.length) % markers.length];
      const current = markers[i];
      const next = markers[(i + 1) % markers.length];

      // 计算球面多边形的内角
      // 使用切线向量方法，可以正确处理大于180度的内角
      
      // 确保顶点在单位球上（已经是单位向量）
      const Pi = current.position.clone().normalize();
      const Pi_prev = prev.position.clone().normalize();
      const Pi_next = next.position.clone().normalize();
      
      // 计算两个弧向量（投影到切平面）
      // v⃗1 = Pᵢ₋₁ - (Pᵢ ⋅ Pᵢ₋₁)Pᵢ
      // v⃗2 = Pᵢ₊₁ - (Pᵢ ⋅ Pᵢ₊₁)Pᵢ
      const dot1 = Pi.dot(Pi_prev);
      const dot2 = Pi.dot(Pi_next);
      
      const v1 = Pi_prev.clone().sub(Pi.clone().multiplyScalar(dot1));
      const v2 = Pi_next.clone().sub(Pi.clone().multiplyScalar(dot2));
      
      // 计算夹角：αᵢ = arccos((v⃗1 ⋅ v⃗2) / (|v⃗1||v⃗2|))
      const v1Length = v1.length();
      const v2Length = v2.length();
      
      if (v1Length === 0 || v2Length === 0) {
        // 处理退化情况
        angles.push({
          vertex: current.position,
          angle: 0,
          label: "0.0°"
        });
        continue;
      }
      
      const dotProduct = v1.dot(v2) / (v1Length * v2Length);
      let angle = Math.acos(Math.max(-1, Math.min(1, dotProduct))) * 180 / Math.PI;
      
      // 判断角度的方向性（内角还是外角）
      // 使用叉积来确定角度的方向
      const crossProduct = v1.clone().cross(v2);
      const normalDot = crossProduct.dot(Pi);
      
      // 对于球面多边形，我们需要确保计算的是内角
      // 内角应该是朝向多边形内部的角度
      // 如果法向量与球心到顶点的向量反向，则为内角；否则需要取补角
      if (normalDot > 0) {
        angle = 360 - angle;
      }

      angles.push({
        vertex: current.position,
        angle: angle,
        label: `${angle.toFixed(1)}°`
      });
    }

    return angles;
  };

  // 处理标记点击
  const handleMarkerClick = useCallback((position: THREE.Vector3) => {
    const newMarker: Marker = {
      id: `marker-${Date.now()}`,
      position: position.clone(),
      index: markers.length
    };

    const newMarkers = [...markers, newMarker];
    setMarkers(newMarkers);

    // 如果有多个点，创建测地线
    if (newMarkers.length > 1) {
      // 使用凸包算法确保正确的连接顺序
      const hullMarkers = calculateSphericalConvexHull(newMarkers);
      const newLines: GeodesicLine[] = [];
      
      for (let i = 0; i < hullMarkers.length; i++) {
        const start = hullMarkers[i];
        const end = hullMarkers[(i + 1) % hullMarkers.length];
        
        const geodesicPoints = calculateGeodesic(start.position, end.position);
        
        newLines.push({
          id: `line-${i}`,
          start: start.position,
          end: end.position,
          points: geodesicPoints
        });
      }
      
      setGeodesicLines(newLines);

      // 计算角度
      if (hullMarkers.length >= 3) {
        const sphericalAngles = calculateSphericalAngles(hullMarkers);
        const planarAngles = calculatePlanarAngles(hullMarkers);
        setAngleInfo(sphericalAngles);
        setPlanarAngleInfo(planarAngles);
      } else {
        setAngleInfo([]);
        setPlanarAngleInfo([]);
      }
    }
  }, [markers]);

  // 清除所有标记
  const clearMarkers = () => {
    setMarkers([]);
    setGeodesicLines([]);
    setAngleInfo([]);
    setPlanarAngleInfo([]);
  };

  // 计算内角和
  const totalSphericalAngle = angleInfo.reduce((sum, angle) => sum + angle.angle, 0);
  // 平面多边形的内角和使用公式：(n-2) × 180°
  const totalPlanarAngle = markers.length >= 3 ? (markers.length - 2) * 180 : 0;
  const angleDifference = totalSphericalAngle - totalPlanarAngle;

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <Canvas camera={{ position: [0, 0, 3], fov: 75 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <InteractiveSphere
          markers={markers}
          geodesicLines={geodesicLines}
          onMarkerClick={handleMarkerClick}
          angleInfo={angleInfo}
          showPlanarProjection={showPlanarProjection}
          projectToPlane={projectToPlane}
        />
        <OrbitControls enableDamping dampingFactor={0.05} />
      </Canvas>

      {/* 左侧控制面板 */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        width: '280px',
        maxHeight: 'calc(100vh - 40px)',
        overflowY: 'auto',
        background: 'rgba(255, 255, 255, 0.95)',
        padding: '20px',
        borderRadius: '12px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
        fontFamily: 'Arial, sans-serif',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.2)'
      }}>
        <h3 style={{ margin: '0 0 20px 0', color: '#2C3E50', fontSize: '18px', fontWeight: 'bold' }}>
          球面几何学习
        </h3>
        
        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#34495E', fontWeight: '600' }}>
            操作说明
          </h4>
          <div style={{ fontSize: '12px', color: '#7F8C8D', lineHeight: '1.5' }}>
            • 点击球面放置标记点<br/>
            • 标记点自动连接成测地线<br/>
            • 形成封闭图形时显示角度<br/>
            • 同时显示平面投影对比
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#34495E', fontWeight: '600' }}>
            当前状态
          </h4>
          <div style={{ fontSize: '12px', color: '#7F8C8D', lineHeight: '1.5' }}>
            标记点数: <span style={{ fontWeight: 'bold', color: '#2C3E50' }}>{markers.length}</span><br/>
            {angleInfo.length > 0 && (
              <>
                球面内角和: <span style={{ fontWeight: 'bold', color: '#E74C3C' }}>{totalSphericalAngle.toFixed(1)}°</span><br/>
                平面内角和: <span style={{ fontWeight: 'bold', color: '#3498DB' }}>{totalPlanarAngle.toFixed(1)}°</span><br/>
                差值: <span style={{ fontWeight: 'bold', color: '#27AE60' }}>{angleDifference.toFixed(1)}°</span><br/>
                几何类型: <span style={{ fontWeight: 'bold', color: '#8E44AD' }}>{markers.length === 3 ? '三角形' : `${markers.length}边形`}</span>
              </>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
          <button
            onClick={clearMarkers}
            style={{
              background: '#E74C3C',
              color: 'white',
              border: 'none',
              padding: '10px 16px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '500',
              transition: 'all 0.3s ease',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
            }}
          >
            清除所有标记
          </button>
        </div>
      </div>

      {/* 右侧角度信息显示 */}
      {angleInfo.length > 0 && (
        <div style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          width: '320px',
          maxHeight: 'calc(100vh - 40px)',
          overflowY: 'auto',
          background: 'rgba(255, 255, 255, 0.95)',
          padding: '20px',
          borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
          fontFamily: 'Arial, sans-serif',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.2)'
        }}>
          <h4 style={{ margin: '0 0 20px 0', color: '#2C3E50', fontSize: '16px', fontWeight: 'bold' }}>
            几何对比分析
          </h4>
          
          <div style={{ marginBottom: '20px' }}>
            <h5 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#E74C3C', fontWeight: '600' }}>
              球面几何角度
            </h5>
            <div style={{ marginBottom: '8px' }}>
              {angleInfo.map((angle, index) => (
                <div key={index} style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  margin: '4px 0',
                  fontSize: '12px',
                  color: '#7F8C8D'
                }}>
                  <span>顶点 {index + 1}:</span>
                  <span style={{ fontWeight: 'bold', color: '#E74C3C' }}>{angle.angle.toFixed(1)}°</span>
                </div>
              ))}
            </div>
            <div style={{ 
              padding: '8px 12px', 
              backgroundColor: '#FDF2F2', 
              borderRadius: '6px',
              border: '1px solid #FECACA'
            }}>
              <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#E74C3C' }}>
                球面内角和: {totalSphericalAngle.toFixed(1)}°
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <h5 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#3498DB', fontWeight: '600' }}>
              平面几何角度
            </h5>
            <div style={{ marginBottom: '8px' }}>
              {planarAngleInfo.map((angle, index) => (
                <div key={index} style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  margin: '4px 0',
                  fontSize: '12px',
                  color: '#7F8C8D'
                }}>
                  <span>顶点 {index + 1}:</span>
                  <span style={{ fontWeight: 'bold', color: '#3498DB' }}>{angle.angle.toFixed(1)}°</span>
                </div>
              ))}
            </div>
            <div style={{ 
              padding: '8px 12px', 
              backgroundColor: '#EBF8FF', 
              borderRadius: '6px',
              border: '1px solid #BEE3F8'
            }}>
              <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#3498DB' }}>
                平面内角和: {totalPlanarAngle.toFixed(1)}°
              </div>
            </div>
          </div>

          <div style={{ 
            padding: '12px',
            backgroundColor: angleDifference > 0 ? '#F0FDF4' : '#FFFBEB',
            borderRadius: '8px',
            border: `1px solid ${angleDifference > 0 ? '#BBF7D0' : '#FED7AA'}`
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '6px'
            }}>
              <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#27AE60' }}>
                差值
              </span>
              <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#27AE60' }}>
                {angleDifference.toFixed(1)}°
              </span>
            </div>
            <div style={{ fontSize: '12px', color: '#7F8C8D', lineHeight: '1.4' }}>
              {angleDifference > 0 ? '球面几何内角和大于平面几何' : '球面几何内角和小于平面几何'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

