// Touch halves and keyboard steering. "Most recent input wins" across both.

const KEY_DIRS = {
    ArrowLeft: -1,
    a: -1,
    A: -1,
    ArrowRight: 1,
    d: 1,
    D: 1
};

export function createInput(element) {
    // Held inputs in press order. Entries: { id, dir } where dir is a number
    // (keys) or null (pointers, direction read from the stored clientX).
    const held = [];
    const pointerX = new Map();
    const tapCallbacks = [];

    function pointerDir(x) {
        return x < window.innerWidth / 2 ? -1 : 1;
    }

    function remove(id) {
        const i = held.findIndex((h) => h.id === id);
        if (i !== -1) held.splice(i, 1);
    }

    function press(id, dir) {
        remove(id);
        held.push({ id, dir });
    }

    // source is 'pointer' or 'key'
    function fireTap(source) {
        for (const cb of tapCallbacks) cb(source);
    }

    element.addEventListener('pointerdown', (e) => {
        // A press that starts on a button (such as Pause) is not steering.
        if (e.target !== element) return;
        e.preventDefault();
        const id = 'p' + e.pointerId;
        pointerX.set(e.pointerId, e.clientX);
        press(id, null);
        fireTap('pointer');
    });

    element.addEventListener('pointermove', (e) => {
        if (pointerX.has(e.pointerId)) {
            e.preventDefault();
            pointerX.set(e.pointerId, e.clientX);
        }
    });

    function release(e) {
        if (!pointerX.has(e.pointerId)) return;
        e.preventDefault();
        pointerX.delete(e.pointerId);
        remove('p' + e.pointerId);
    }

    element.addEventListener('pointerup', release);
    element.addEventListener('pointercancel', release);
    element.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space' || e.key === 'Enter') {
            // Let a focused button handle its own Space and Enter.
            if (e.target && e.target.closest && e.target.closest('button')) return;
            e.preventDefault();
            if (!e.repeat) fireTap('key');
            return;
        }
        if (e.key in KEY_DIRS) {
            e.preventDefault();
            if (!e.repeat) press('k' + e.key, KEY_DIRS[e.key]);
        }
    });

    window.addEventListener('keyup', (e) => {
        if (e.key in KEY_DIRS) remove('k' + e.key);
    });

    window.addEventListener('blur', () => {
        held.length = 0;
        pointerX.clear();
    });

    return {
        // True while a left and a right input are both held.
        both() {
            let left = false;
            let right = false;
            for (const h of held) {
                const dir = h.dir !== null ? h.dir : pointerDir(pointerX.get(Number(h.id.slice(1))));
                if (dir < 0) left = true;
                else right = true;
            }
            return left && right;
        },
        steer() {
            if (held.length === 0 || this.both()) return 0;
            const last = held[held.length - 1];
            if (last.dir !== null) return last.dir;
            return pointerDir(pointerX.get(Number(last.id.slice(1))));
        },
        onTap(callback) {
            tapCallbacks.push(callback);
        }
    };
}
