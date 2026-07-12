
// إعدادات اللعبة
const config = {
    type: Phaser.AUTO,
    width: 450,
    height: 800,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    backgroundColor: '#2c3e50',
    scene: [StartScene, GameScene, GameOverScene]
};

function loadGame() {
    new Phaser.Game(config);
}

// --- مشهد البداية ---
class StartScene extends Phaser.Scene {
    constructor() { super('StartScene'); }
    create() {
        this.add.text(225, 200, 'لعبة الحلوى', { fontSize: '40px', fill: '#fff' }).setOrigin(0.5);
        let btn = this.add.text(225, 400, 'ابدأ اللعب', { fontSize: '30px', fill: '#f1c40f', backgroundColor: '#333', padding: {x:20, y:10} }).setOrigin(0.5).setInteractive();
        btn.on('pointerdown', () => this.scene.start('GameScene'));
    }
}

// --- مشهد اللعبة الأساسي ---
class GameScene extends Phaser.Scene {
    constructor() { super('GameScene'); }
    preload() {
        // توليد صور برمجية
        const colors = [0xff4757, 0x1e90ff, 0x2ed573, 0xeccc68, 0x9b59b6];
        colors.forEach((c, i) => {
            let g = this.add.graphics();
            g.fillStyle(c, 1);
            g.fillRoundedRect(0, 0, 46, 46, 10);
            g.generateTexture('candy'+i, 50, 50);
            g.destroy();
        });
        // جسيم للانفجار
        let g = this.add.graphics(); g.fillStyle(0xffffff, 1); g.fillCircle(10, 10, 10);
        g.generateTexture('particle', 20, 20); g.destroy();
    }

    create() {
        this.board = []; this.score = 0; this.isSwapping = false;
        this.scoreText = this.add.text(20, 20, 'النقاط: 0', { fontSize: '24px', fill: '#fff' });
        this.timer = 60;
        this.timerText = this.add.text(300, 20, 'الوقت: 60', { fontSize: '24px', fill: '#fff' });
        this.time.addEvent({ delay: 1000, callback: () => {
            this.timer--;
            this.timerText.setText('الوقت: ' + this.timer);
            if(this.timer <= 0) this.scene.start('GameOverScene', { score: this.score });
        }, loop: true });

        for (let r = 0; r < 8; r++) {
            this.board[r] = [];
            for (let c = 0; c < 8; c++) {
                let type = Phaser.Math.Between(0, 4);
                let s = this.add.image(50 + c * 50, 150 + r * 50, 'candy'+type).setInteractive();
                s.setData({row: r, col: c, type: type});
                this.board[r][c] = { type, sprite: s };
            }
        }
        this.input.on('gameobjectdown', (ptr, obj) => { if(!this.isSwapping) this.selected = obj; });
        this.input.on('pointerup', this.handleSwap, this);

        FBInstant.startGameAsync();
    }

    handleSwap(ptr) {
        if(!this.selected || this.isSwapping) return;
        let r = this.selected.getData('row'), c = this.selected.getData('col');
        let dx = ptr.upX - ptr.downX, dy = ptr.upY - ptr.downY;
        let tr = r, tc = c;
        if(Math.abs(dx) > Math.abs(dy)) dx > 0 ? tc++ : tc--; else dy > 0 ? tr++ : tr--;
        if(tr >=0 && tr < 8 && tc >=0 && tc < 8) this.performSwap(r, c, tr, tc);
    }

    performSwap(r1, c1, r2, c2) {
        this.isSwapping = true;
        let s1 = this.board[r1][c1].sprite, s2 = this.board[r2][c2].sprite;
        this.tweens.add({ targets: [s1, s2], x: [s2.x, s1.x], y: [s2.y, s1.y], duration: 200, onComplete: () => {
            [this.board[r1][c1], this.board[r2][c2]] = [this.board[r2][c2], this.board[r1][c1]];
            s1.setData({row: r2, col: c2}); s2.setData({row: r1, col: c1});
            if(!this.checkMatches()) {
                this.time.delayedCall(300, () => this.performSwap(r2, c2, r1, c1));
            } else { this.isSwapping = false; }
        }});
    }

    checkMatches() {
        let matches = new Set();
        // منطق الفحص (أفقي وعمودي)
        for(let r=0; r<8; r++) for(let c=0; c<6; c++) if(this.board[r][c] && this.board[r][c+1] && this.board[r][c+2] && this.board[r][c].type == this.board[r][c+1].type && this.board[r][c].type == this.board[r][c+2].type) { matches.add(this.board[r][c]); matches.add(this.board[r][c+1]); matches.add(this.board[r][c+2]); }
        for(let c=0; c<8; c++) for(let r=0; r<6; r++) if(this.board[r][c] && this.board[r+1][c] && this.board[r+2][c] && this.board[r][c].type == this.board[r+1][c].type && this.board[r][c].type == this.board[r+2][c].type) { matches.add(this.board[r][c]); matches.add(this.board[r+1][c]); matches.add(this.board[r+2][c]); }
        
        if(matches.size === 0) return false;
        this.score += matches.size * 10; this.scoreText.setText('النقاط: ' + this.score);
        let count = 0;
        matches.forEach(m => {
            let r = m.sprite.getData('row'), c = m.sprite.getData('col');
            this.tweens.add({ targets: m.sprite, scale: 0, duration: 200, onComplete: () => {
                m.sprite.destroy(); this.board[r][c] = null; count++;
                if(count === matches.size) this.fillHoles();
            }});
        });
        return true;
    }

    fillHoles() {
        for (let c = 0; c < 8; c++) {
            for (let r = 7; r >= 0; r--) {
                if (this.board[r][c] === null) {
                    for (let k = r - 1; k >= 0; k--) {
                        if (this.board[k][c] !== null) {
                            this.board[r][c] = this.board[k][c]; this.board[k][c] = null;
                            this.board[r][c].sprite.setData({row: r, col: c});
                            this.tweens.add({ targets: this.board[r][c].sprite, y: 150 + r * 50, duration: 200 });
                            break;
                        }
                    }
                }
            }
        }
        for (let c = 0; c < 8; c++) {
            for (let r = 0; r < 8; r++) {
                if (this.board[r][c] === null) {
                    let type = Phaser.Math.Between(0, 4);
                    let s = this.add.image(50 + c * 50, -50, 'candy'+type).setInteractive();
                    s.setData({row: r, col: c, type: type});
                    this.board[r][c] = { type, sprite: s };
                    this.tweens.add({ targets: s, y: 150 + r * 50, duration: 300 });
                }
            }
        }
        this.time.delayedCall(400, () => { if(!this.checkMatches()) this.isSwapping = false; });
    }
}

// --- مشهد النهاية ---
class GameOverScene extends Phaser.Scene {
    constructor() { super('GameOverScene'); }
    init(data) { this.finalScore = data.score; }
    create() {
        let best = localStorage.getItem('hs') || 0;
        if(this.finalScore > best) localStorage.setItem('hs', this.finalScore);
        this.add.text(225, 200, 'انتهت اللعبة!', { fontSize: '40px', fill: '#fff' }).setOrigin(0.5);
        this.add.text(225, 300, 'النقاط: ' + this.finalScore, { fontSize: '30px' }).setOrigin(0.5);
        let btn = this.add.text(225, 500, 'العب مجدداً', { fontSize: '25px', backgroundColor: '#333', padding: {x:10, y:5} }).setOrigin(0.5).setInteractive();
        btn.on('pointerdown', () => this.scene.start('GameScene'));
    }
}
