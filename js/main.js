require.config({
  baseUrl: './js',
  paths: {
    'three.obj':    'lib/loaders/OBJLoader'
  },
  shim: {
    'three.obj': {
      deps: ['lib/three']
    }
  }
});

require([
  'lib/lodash.min',
  'lib/jquery-1.9.0.min',
  'lib/dat.gui.min',
  'three.obj'
], function() {
  var width     = 640,
      height    = 480,
      renderer  = new THREE.WebGLRenderer(),
      scene     = new THREE.Scene(),
      camera    = Camera(width/height),
      light     = DirectionalLight().add_to(scene),
      env       = EnvironmentMaps('castle'),
      tex       = MaterialTextures('dagger'),
      pbr       = PBR().textures(tex).environments(env),
      loader    = new THREE.OBJLoader(new THREE.LoadingManager());

  $('#view').append(renderer.domElement);
  
  Skybox().cubemap(env.radiance(0)).add_to(scene);

  // models
  //
  var dagger = null;
  loader.load('asset/dagger/mesh.obj', function(obj) {
    obj.traverse(function(child) {
      if (child instanceof THREE.Mesh) {
        child.material = pbr.material();
      }
    });

    obj.position.y = -15;
    dagger = obj;
  });

  var sphere = new THREE.Mesh(
    new THREE.SphereGeometry(25, 128, 128), 
    pbr.material()
  );

  renderer.setSize(width, height);
  camera.update();
  light.update();
  scene.add(sphere);
  pbr.update();

  animate();



  // update functions
  //
  function animate(ts) {
    requestAnimationFrame(animate);   
    render();
  };

  function render() {
    camera.look_at(scene.position);
    renderer.render(scene, camera.get());
  };

  // mouse events
  //
  $('#view > canvas').on('mousemove', function(e) {
    if (!e.which) {
      return;
    }

    var oe = e.originalEvent;
    var dx = (oe.webkitMovementX * 0.5);
    var dy = (oe.webkitMovementY * 0.5);

    if (oe.button === 0) {
      light.rotate(dx, -dy);
    }
    if (oe.button === 2) {
      camera.rotate(-dx, dy)
    }
  });

  $('#view > canvas').on('mousewheel', function(e) {
    var delta = e.originalEvent.wheelDelta;
    camera.zoom(delta / Math.abs(delta) * -10.0);
  });



  // controls
  //
  var ctrl    = Controls();
  var gui     = new dat.GUI();

  var menu    = ['constant', 'texture'];
  var menu_m  = ['dagger', 'sphere'];
  var menu_f  = ['schlick', 'schlick_ue4', 'cooktorrance'];
  var menu_d  = ['blinnphong', 'beckmann', 'ggx'];
  var menu_g  = [ 'implicit', 'cooktorrance', 'schlick', 'schlick_ue4', 'smith', 'walter' ];

  var fld_model     = gui.addFolder('Model');
  fld_model.add(ctrl.model, 'use', menu_m).onChange(function(v) {
    scene.remove((v === 'dagger')? sphere : dagger);
    scene.add((v === 'dagger')? dagger : sphere);
  });

  var fld_albedo = gui.addFolder('Albedo');
  fld_albedo.add(ctrl.albedo, 'use', menu).onChange(makedef('albedo'));
  fld_albedo.addColor(ctrl.albedo, 'color').onChange(makeuni('c_albedo'));

  var fld_specular = gui.addFolder('Specular');
  fld_specular.add(ctrl.specular, 'use', menu).onChange(makedef('specular'));
  fld_specular.addColor(ctrl.specular, 'color').onChange(makeuni('c_specular'));
  fld_specular.open();

  var fld_fresnel = gui.addFolder('Fresnel');
  fld_fresnel.add(ctrl.fresnel, 'use', menu_f).onChange(makedef('fresnel'));

  var fld_ndf = gui.addFolder('NDF');
  fld_ndf.add(ctrl.ndf, 'use', menu_d).onChange(makedef('ndf'));

  var fld_geometry = gui.addFolder('Geometry');
  fld_geometry.add(ctrl.geometry, 'use', menu_g).onChange(makedef('geometry'));

  var fld_roughness = gui.addFolder('Roughness');
  fld_roughness.add(ctrl.roughness, 'use', menu).onChange(makedef('roughness'));
  fld_roughness.add(ctrl.roughness, 'constant', 0.0001, 1.0).onChange(makeuni('f_roughness'));
  fld_roughness.open();

  var fld_dl = gui.addFolder('Directional Light');
  fld_dl.add(ctrl.dl, 'intensity', 0, 10.0).onChange(makeuni('f_dl_intensity'));
  fld_dl.addColor(ctrl.dl, 'color').onChange(light.color);
  fld_dl.open();

  var fld_el = gui.addFolder('Environment Light');
  fld_el.add(ctrl.el, 'intensity', 0, 10.0).onChange(makeuni('f_el_intensity'));
  fld_el.open();

  gui.add(ctrl, 'ao').onChange(makedef('ao'));
  gui.add(ctrl, 'cavity').onChange(makedef('cavity'));

  function makeuni(name) {
    return function(v) {
      pbr.uniform(name, v);
    };
  };

  function makedef(name) {
    return function(v) {
      pbr.define(name, v);
    }
  };

  

  // etc
  //
  function Camera(aspect) {
    var ctx = {};

    var cam  = new THREE.PerspectiveCamera(45, aspect, 1, 5000);
    var theta   = 180 * Math.PI / 180.0;
    var phi     = 0;
    var radius  = 150;

    ctx.get = function() {
      return cam;
    };

    ctx.look_at = function(pos) {
      cam.lookAt(pos);

      return ctx;
    };

    ctx.rotate = function(dx, dy) {
      theta += (dx * Math.PI / 180.0);
      phi   += (dy * Math.PI / 180.0);

      return ctx.update();
    };

    ctx.zoom = function(dz) {
      radius += dz;

      return ctx.update();
    };

    ctx.update = function() {
      cam.position.x = radius * Math.sin(theta) * Math.cos(phi);
      cam.position.y = radius * Math.sin(phi);
      cam.position.z = radius * Math.cos(theta) * Math.cos(phi);
      cam.updateMatrix();

      return ctx;
    }

    return ctx;
  };

  function Controls() {
    var ctx = {};

    ctx.model = {};
    ctx.model.use = 'sphere';

    ctx.albedo = {};
    ctx.albedo.use = 'constant';
    ctx.albedo.color = '#FFFFFF';

    ctx.specular = {};
    ctx.specular.use = 'constant';
    ctx.specular.color = '#FFFFFF';

    ctx.fresnel = {};
    ctx.fresnel.use = 'schlick';

    ctx.ndf = {};
    ctx.ndf.use = 'blinnphong';

    ctx.geometry = {};
    ctx.geometry.use = 'cooktorrance';

    ctx.roughness = {};
    ctx.roughness.use = 'constant';
    ctx.roughness.constant = 0.5;

    ctx.dl = {};
    ctx.dl.intensity = 1.0;
    ctx.dl.color = '#FFFFFF';

    ctx.el = {};
    ctx.el.intensity = 1.0;

    ctx.ao = false;
    ctx.cavity = false;

    return ctx;
  };

  function DirectionalLight() {
    var ctx = {};

    var theta = 225 * Math.PI / 180.0;
    var phi   = 45  * Math.PI / 180.0;

    var light     = new THREE.DirectionalLight(0xFFFFFF);
    var material  = new THREE.LineBasicMaterial({ color: 0xFFFFFF });
    var geometry  = new THREE.Geometry();
    var object    = new THREE.Line(geometry, material);

    geometry.vertices.push(new THREE.Vector3(0, 0, 0));
    geometry.vertices.push(new THREE.Vector3(0, 0, 0));

    ctx.add_to = function(scene) {
      scene.add(light);
      scene.add(object);

      return ctx;
    };

    ctx.color = function(c) {
      light.color = new THREE.Color(c);
      material.color = new THREE.Color(c);

      return ctx;
    };

    ctx.rotate = function(dx, dy) {
      theta += (dx * Math.PI / 180.0);
      phi   += (dy * Math.PI / 180.0);

      ctx.update();

      return ctx;
    };

    ctx.update = function() {
      light.position.set(
        Math.sin(theta) * Math.cos(phi),
        Math.sin(phi),
        Math.cos(theta) * Math.cos(phi)
      );

      geometry.vertices[1].x = 50.0 * light.position.x;
      geometry.vertices[1].y = 50.0 * light.position.y;
      geometry.vertices[1].z = 50.0 * light.position.z;

      geometry.verticesNeedUpdate = true;

      return ctx;
    };

    return ctx;
  };

  function EnvironmentMaps(name) {
  var ctx = {};
  var loader = THREE.ImageUtils.loadDDSTexture;

  var irradiance = loader('asset/' + name + '/irradiance.dds');
  irradiance.minFilter = irradiance.maxFilter = THREE.LinearFilter;

  var radiance = [];

  radiance.push(loader('asset/' + name + '/specular.dds'));
  radiance[0].minFilter = radiance[0].maxFilter = THREE.LinearFilter;

  function mip(lv) {
    return loader('asset/' + name + '/radiance.dds', THREE.UVMapping, function(tex) {
      for (var i = 0; i < 6; ++i) {
        var face = tex.image[i];
        face.mipmaps  = face.mipmaps.slice(lv, lv+1);
        face.width    = face.mipmaps[0].width;
        face.height   = face.mipmaps[0].height;
      }
    });
  }

  for (var i = 1; i < 5; ++i) {
    radiance.push(mip(i-1));
    radiance[i].minFilter = radiance[i].maxFilter = THREE.LinearFilter;
  }

  ctx.irradiance = function() {
    return irradiance;
  };

  ctx.radiance = function(lv) {
    return radiance[lv];
  };

  return ctx;
};

  function PBR() {
    var ctx = {};

    var vs = $('#vs').text();
    var fs = $('#fs').text();

    var defines = {
      albedo:     'USE_ALBEDO_CONSTANT',
      ao:         null,
      cavity:     null,
      fresnel:    'USE_FRESNEL_SCHLICK',
      geometry:   'USE_GEOMETRY_COOKTORRANCE',
      ndf:        'USE_NDF_BLINNPHONG',
      roughness:  'USE_ROUGHNESS_CONSTANT',
      specular:   'USE_SPECULAR_CONSTANT',
    };

    var uniforms = THREE.UniformsUtils.merge([
      THREE.UniformsLib.common,
      THREE.UniformsLib.lights,
      {
        f_roughness:    { type: 'f', value: 0.5 },
        f_dl_intensity: { type: 'f', value: 1.0 },
        f_el_intensity: { type: 'f', value: 1.0 },
        c_albedo:       { type: 'c', value: new THREE.Color(0xFFFFFF) },
        c_specular:     { type: 'c', value: new THREE.Color(0xFFFFFF) },
        t_albedo:       { type: 't', value: null },
        t_normal:       { type: 't', value: null },
        t_specular:     { type: 't', value: null },
        t_gloss:        { type: 't', value: null },
        t_radiance0:    { type: 't', value: null },
        t_radiance1:    { type: 't', value: null },
        t_radiance2:    { type: 't', value: null },
        t_radiance3:    { type: 't', value: null },
        t_radiance4:    { type: 't', value: null },
        t_irradiance:   { type: 't', value: null }
      }
    ]);

    var material = new THREE.ShaderMaterial({
      vertexShader:   vs,
      fragmentShader: fs,
      uniforms:       uniforms,
      lights:         true
    });

    ctx.material = function() {
      return material;
    };

    ctx.define = function(name, value) {
      var def = 'USE_' + name.toUpperCase();
      if (_.isString(value)) {
        def += ('_' + value.toUpperCase());
      }
      defines[name] = def;

      return ctx.update();
    };

    ctx.uniform = function(name, value) {
      uniforms[name].value = _.isString(value)? new THREE.Color(value) : value;
      return ctx;
    };

    ctx.textures = function(tex) {
      uniforms.t_albedo.value     = tex.albedo();
      uniforms.t_normal.value     = tex.normal();
      uniforms.t_specular.value   = tex.specular();
      uniforms.t_gloss.value      = tex.gloss();

      return ctx;
    };

    ctx.environments = function(env) {
      uniforms.t_radiance0.value  = env.radiance(0);
      uniforms.t_radiance1.value  = env.radiance(1);
      uniforms.t_radiance2.value  = env.radiance(2);
      uniforms.t_radiance3.value  = env.radiance(3);
      uniforms.t_radiance4.value  = env.radiance(4);
      uniforms.t_irradiance.value = env.irradiance();

      return ctx;
    };

    ctx.update = function() {
      var defs = _.map(_.compact(_.values(defines)), function(v) {
        return '#define ' + v;
      });

      material.needsUpdate = true;
      material.fragmentShader = defs.join('\n') + fs;
    };

    return ctx;
  };

  function Skybox() {
    var ctx = {};

    var uniforms = THREE.UniformsUtils.clone(THREE.ShaderLib.cube.uniforms);
    var geometry = new THREE.BoxGeometry(1000, 1000, 1000, 1, 1, 1);
    var material = new THREE.ShaderMaterial({ 
      vertexShader:   THREE.ShaderLib.cube.vertexShader,
      fragmentShader: THREE.ShaderLib.cube.fragmentShader,
      uniforms:       uniforms, 
      side:           THREE.BackSide 
    });
    var object = new THREE.Mesh(geometry, material);

    ctx.add_to = function(scene) {
      scene.add(object);

      return ctx;
    };

    ctx.cubemap = function(tex) {
      uniforms.tCube.value = tex;

      return ctx;
    };

    return ctx;
  };

  function MaterialTextures(name) {
    var ctx = {};
    var loader = THREE.ImageUtils.loadDDSTexture;

    var albedo = loader('asset/' + name + '/albedo.dds');
    albedo.minFilter = albedo.maxFilter = THREE.LinearFilter;

    var normal = loader('asset/' + name + '/normal.dds');
    normal.minFilter = normal.maxFilter = THREE.LinearFilter;

    var specular = loader('asset/' + name + '/specular.dds');
    specular.minFilter = specular.maxFilter = THREE.LinearFilter;

    var gloss = loader('asset/' + name + '/gloss.dds');
    gloss.minFilter = gloss.maxFilter = THREE.LinearFilter;

    ctx.albedo = function() {
      return albedo;
    };

    ctx.normal = function() {
      return normal;
    };

    ctx.specular = function() {
      return specular;
    };

    ctx.gloss = function() {
      return gloss;
    };

    return ctx;
  };
});
