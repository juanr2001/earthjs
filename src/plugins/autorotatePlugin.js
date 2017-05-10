export default function(degPerSec) {
    var _ = {
        spin: true,
        lastTick: null,
        degree: degPerSec
    }

    return {
        name: 'autorotatePlugin',
        onInit() {},
        onInterval() {
            var now = new Date();
            if (!_.lastTick || !_.spin || this._.drag) {
                _.lastTick = now;
            } else {
                var delta = now - _.lastTick;
                var r = this._.proj.rotate();
                r[0] += _.degree * delta / 1000;
                if (r[0] >= 180)
                    r[0] -= 360;
                this._.rotate(r);
                _.lastTick = now;
            }
        },
        speed(degPerSec) {
            _.degree = degPerSec;
        },
        start() {
            _.spin = true;
        },
        stop() {
            _.spin = false;
        }
    };
}