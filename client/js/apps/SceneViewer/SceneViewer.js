import React from 'react';
import ReactDOM from 'react-dom';

import csvparse from 'csv-parse';

import RootUI from './view/RootUI';
import MeshOptionsUI from './view/MeshOptionsUI';

import * as THREE from 'three/build/three';
window.THREE = THREE;
import * as d3 from 'd3/build/d3';

import * as PolygonInstanceGLSL from '../../lib/shader/PolygonInstanceGLSL'
import PickVisibleVertex from "../../lib/vao/PickVisibleVertex";
import WindowManager from "../Common/WindowManager"
import SceneModel from "../../lib/vao/SceneModel"
import OBJModel from "../../lib/vao/OBJModel"
import Wireframe from "../../lib/vao/Wireframe"


class SceneViewer {

    init(filename) {
		//this.model_loader = new ModelLoader();
        this.window0 = null;
		this.models = [];

        this.advance_ref = this.advance.bind(this);

        this.draw_root();

		this.window0 = new WindowManager("id_div_panel0", "id_div_canvas0");
		this.window0.init();
		this.attach_listener(this.window0);


		this.pvv = new PickVisibleVertex();
		this.pvv.init(this.window0.gl, this.window0.window_width, this.window0.window_height);
		this.pvv.set_active();

		xhr_json("GET", "/download/json/" + filename).then(res => {
			let trs_global = this.parse_trs(res["trs_global"]["trans"], res["trs_global"]["rot"], res["trs_global"]["scale"]);
			let t0 = new THREE.Matrix4();
			let r0 = new THREE.Matrix4();
			let s0 = new THREE.Matrix4();

			t0.makeTranslation(trs_global.trans.x, trs_global.trans.y, trs_global.trans.z);
			r0.makeRotationFromQuaternion(trs_global.rot);
			s0.makeScale(trs_global.scale.x, trs_global.scale.y, trs_global.scale.z);

			let M_global = new THREE.Matrix4();
			M_global.premultiply(s0);
			M_global.premultiply(r0);
			M_global.premultiply(t0);

			for (let [i,mesh] of Object.entries(res["meshes"])) {
				let filename = mesh["filename"];
				let trs = this.parse_trs(mesh["trs"]["trans"], mesh["trs"]["rot"], mesh["trs"]["scale"]);

				this.load_mesh(filename).then(obj => {

					obj.scale_matrix.makeScale(trs.scale.x, trs.scale.y, trs.scale.z);
					obj.rotation_matrix.makeRotationFromQuaternion(trs.rot);
					obj.translation_matrix.makeTranslation(trs.trans.x, trs.trans.y, trs.trans.z);
					obj.calc_model_matrix();

					this.correct_mesh_trs(obj, M_global);

					let label_buffer = new Int32Array(obj.position_buffer.length/3);
					label_buffer.fill(i + 1)

					this.models.push(obj);

					//let wireframe = new Wireframe();
					//wireframe.init(this.window0.gl);
					//wireframe.is_visible = 1;
					//wireframe.update_box(obj.bounding_box.x, obj.bounding_box.y, obj.bounding_box.z);
					//wireframe.model_matrix = obj.model_matrix;
					//this.models.push(wireframe);
				});
			}
		});

		this.advance();
    }

	correct_mesh_trs(model, M_global) {
		let model_matrix = model.model_matrix;
		model_matrix.premultiply(M_global);
		let t = new THREE.Vector3(); let q = new THREE.Quaternion(); let s = new THREE.Vector3();
		model_matrix.decompose(t, q, s);

		let trans = (new THREE.Matrix4()).makeTranslation(t.x, t.y, t.z);
		let rot = (new THREE.Matrix4()).makeRotationFromQuaternion(q);
		let scale = (new THREE.Matrix4()).makeScale(s.x, s.y, s.z);

		model.translation_matrix = trans;
		model.rotation_matrix = rot;
		model.scale_matrix = scale;
		model.calc_model_matrix();
	}
	
	parse_trs(trans0, rot0, scale0) {
		let scale = new THREE.Vector3().fromArray(scale0.slice(0));
		rot0 = [rot0[1], rot0[2], rot0[3], rot0[0]];
		let rot = new THREE.Quaternion().fromArray(rot0.slice(0)).normalize();

		let trans = new THREE.Vector3().fromArray(trans0.slice(0));
		return {"trans" : trans, "rot" : rot, "scale" : scale};
	}

    load_mesh(filename, trs) {
        return new Promise((resolve, reject) => {
			if (filename.endsWith("obj")) {
				let obj = new OBJModel();
				obj.init(this.window0.gl);

				obj.load(filename).then( res => {
					resolve(obj);
				});
			} else if (filename.endsWith("ply")) {
				let ply = new SceneModel();
				ply.init(this.window0.gl);

				ply.load(filename).then( res => {
					resolve(ply);
				});

			}
        });
	}

	load_scene(id_scene) {
        return new Promise((resolve, reject) => {
            let scene = new SceneModel();
            scene.init(this.window0.gl);

            scene.load_scene("scannet", id_scene).then( res => {
                resolve(scene);
            });
        });
	}

	static basename(str) {
		let base = new String(str).substring(str.lastIndexOf('/') + 1); 
		if(base.lastIndexOf(".") != -1)       
			base = base.substring(0, base.lastIndexOf("."));
		return base;
	}

	
    advance() {
        this.window0.clear();
        this.window0.advance(0, 16);
		for (let i in this.models) {
			this.models[i].draw(this.window0.camera.matrixWorldInverse, this.window0.projection_matrix);
		}
		
		let pos_mouse = this.window0.get_pos_mouse();
        
		requestAnimationFrame(this.advance_ref);
    }

    draw_root() {
        ReactDOM.render(<RootUI  />, document.getElementById('id_div_root'));
    }

    mouseclick ( event ) {
    }

    mousedown ( event ) {
        this.window0.mousedown(event);
    }

    mouseup( event ) {
        this.window0.mouseup(event);
    }

    mousemove ( event ) {
        this.window0.mousemove(event);
    }

    mousewheel ( event ) {
        this.window0.navigation.mousewheel(event);
    }

    contextmenu( event ) {
        this.window0.navigation.contextmenu(event);
    }

    attach_listener(window) {
        // -> event listeners
        this.contextmenu_ref = this.contextmenu.bind(this);
        this.mouseclick_ref = this.mouseclick.bind(this);
        this.mousemove_ref = this.mousemove.bind(this);
        this.mousedown_ref = this.mousedown.bind(this);
        this.mouseup_ref = this.mouseup.bind(this);
        this.mousewheel_ref = this.mousewheel.bind(this);

        window.add_listener('contextmenu', this.contextmenu_ref);
        window.add_listener('click', this.mouseclick_ref);
        window.add_listener('mousemove', this.mousemove_ref);
        window.add_listener('mousedown', this.mousedown_ref);
        window.add_listener('mouseup', this.mouseup_ref);
        window.add_listener('mousewheel', this.mousewheel_ref);
        // <-
    }

    dispose_listener(window) {
        window.remove_listener( "contextmenu", this.contextmenu_ref);
        window.remove_listener( "click", this.mouseclick_ref);
        window.remove_listener( "mousemove", this.mousemove_ref);
        window.remove_listener( "mousedown", this.mousedown_ref);
        window.remove_listener( "mouseup", this.mouseup_ref);
        window.remove_listener( "mousewheel", this.mousewheel_ref);
    }

}

window.SceneViewer = SceneViewer;
