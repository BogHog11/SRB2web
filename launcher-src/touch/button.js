var { KeyNum, KeyName } = require("./keydef.js");
var elements = require("../gp2/elements.js");

class TouchControlButton {
    static fromSavedData(data) {
        var button = new TouchControlButton(
            data.id,
            data.side,
            data.xPos,
            data.yPos
        );
        return button;
    }

    static createEmptyButtonData(id) {
        var button = new TouchControlButton(
            id,
            "left",
            0,
            0
        );
        var data = button.save();
        button.destroy();
        return data;
    }

    constructor(id, side, xPos, yPos) {
        this.side = side || "left";
        this.xPos = +xPos || 0;
        this.yPos = +yPos || 0;
        this.id = id;
        this.editMode = false;
        this.setInfo();
        this.generateElement();
    }

    isCollide(position) {
        var aRect = position;
        var bRect = this.elm.getBoundingClientRect();

        return !(
        aRect.top + aRect.height < bRect.top ||
        aRect.top > bRect.top + bRect.height ||
        aRect.left + aRect.width < bRect.left ||
        aRect.left > bRect.left + bRect.width
        );
    }

    generateElement() {

        this.elm = elements.createElementsFromJSON([
            {
                element: "div",
                className: "touchActionButton touchControlPosition",
                "data-position": this.side,
                style: {
                    left: this.xPos+"%",
                    top: this.yPos+"%"
                },
                textContent: this.name,
            }
        ])[0];
    }

    setInfo (id) {
        this.name = KeyName[id || this.id] || "Unknown";
        this.pressNum = KeyNum[id || this.id] || 0;
    }

    append (container) {
        this.elm.remove();
        this.container = container;
        container.appendChild(this.elm);
    }

    destroy () {
        this.elm.remove();
        this.container = null;
    }

    save () {
        return {
            id: this.id,
            side: this.side,
            xPos: this.xPos,
            yPos: this.yPos
        };
    }

    process (touchPosition) {
        if (this.isCollide(touchPosition)) {
            this.elm.classList.add("active");
            return this.pressNum;
        }
    }
}

module.exports = {
    TouchControlButton
};