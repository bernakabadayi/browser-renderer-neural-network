import React from 'react';
import ReactDOM from 'react-dom';

import csvparse from 'csv-parse';

import RootUI from './view/RootUI';
import MeshOptionsUI from './view/MeshOptionsUI';

import * as THREE from 'three/build/three';
window.THREE = THREE;
import * as d3 from 'd3/build/d3';

import * as PolygonInstanceGLSL from '../../lib/shader/PolygonInstanceGLSL'
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


		let filename_scene = SceneViewer.basename(filename);
		this.load_scene(filename_scene).then(scene => {
			this.models.push(scene);

			this.load_csv(filename).then(csv => {
				for (let i = 0; i < csv.length; i++) {
					let csv1 = csv[i];
					let id_shapenet = csv1[0];
					let catid_shapenet = csv1[1];
					let trs = this.parse_trs([csv1[2], csv1[3], csv1[4]], [csv1[6], csv1[7], csv1[8], csv1[5]], [csv1[9], csv1[10], csv1[11]]);

					this.load_obj(catid_shapenet, id_shapenet).then(obj => {

						obj.scale_matrix.makeScale(trs.scale.x, trs.scale.y, trs.scale.z);
						obj.rotation_matrix.makeRotationFromQuaternion(trs.rot);
						obj.translation_matrix.makeTranslation(trs.trans.x, trs.trans.y, trs.trans.z);
						obj.calc_model_matrix();
						obj.model_matrix.premultiply(scene.rotation_matrix);
						obj.model_matrix.premultiply(scene.translation_matrix);

						let t0 = new THREE.Vector3(0, 0, 0); let q0 = new THREE.Quaternion(); let s0 = new THREE.Vector3(0, 0, 0); 
						obj.model_matrix.decompose(t0, q0, s0);

						let trans = (new THREE.Matrix4()).makeTranslation(t0.x, t0.y, t0.z);
						let rot = (new THREE.Matrix4()).makeRotationFromQuaternion(q0);
						//rot.identity();
						let scale = (new THREE.Matrix4()).makeScale(s0.x, s0.y, s0.z);

						obj.translation_matrix = trans;
						obj.rotation_matrix = rot;
						obj.scale_matrix = scale;

						var wireframe = new Wireframe();
						wireframe.init(this.window0.gl);
						wireframe.is_visible = 1;
						wireframe.update_box(obj.bounding_box.x, obj.bounding_box.y, obj.bounding_box.z);
						wireframe.model_matrix = obj.model_matrix;
						this.models.push(obj);
						this.models.push(wireframe);
					});
				}
			});
		});
		this.advance();
    }
	
	parse_trs(trans0, rot0, scale0) {
		let scale = new THREE.Vector3().fromArray(scale0.slice(0));
		let rot = new THREE.Quaternion().fromArray(rot0.slice(0)).normalize();

		let trans = new THREE.Vector3().fromArray(trans0.slice(0));
		return {"trans" : trans, "rot" : rot, "scale" : scale};
	}

    load_obj(catid_shapenet, id_shapenet) {
        return new Promise((resolve, reject) => {
            let obj = new OBJModel();
            obj.init(this.window0.gl);

            obj.load(catid_shapenet, id_shapenet).then( res => {
                resolve(obj);
            });
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

	load_csv(filename) {
		return new Promise((resolve, reject) => {
			return xhr("GET", "/download/csv/" + filename).then(csv => {
				csvparse(csv, {comment: '#'}, (err, out) => {
					resolve(out)
				});
			});
		});
	}
	
    advance() {
        this.window0.clear();
        this.window0.advance(0, 16);
		for (let i in this.models) {
			this.models[i].draw(this.window0.camera.matrixWorldInverse, this.window0.projection_matrix);
		}
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
