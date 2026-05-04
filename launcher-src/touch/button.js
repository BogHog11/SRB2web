var { KeyNum, KeyName } = require("./keydef.js");
var elements = require("../gp2/elements.js");

class TouchControlButton {
    static fromSavedData(data) {
        var button = new TouchControlButton(
            data.id,
            data.side,
            data.xPos,
            data.yPos,
            data.width,
            data.height
        );
        return button;
    }

    static createEmptyButtonData(id) {
        var button = new TouchControlButton(
            id,
            "left"
        );
        var data = button.save();
        button.destroy();
        return data;
    }

    constructor(id, side, xPos, yPos, width, height) {
        this.side = side || "left";
        this.xPos = +xPos || 0;
        this.yPos = +yPos || 0;
        this.width = +width || 0;
        this.height = +height || 0;
        this.id = id;
        this.randomId = Date.now()+"_"+(Math.random()*100000); //Random ID to identify this button in edit mode, since the id can be duplicated.
        this.editMode = false;

        this.setInfo(this.id);
        this._justPressed = false;
    }

    isCollide(position, elm) {
        var aRect = position;
        var bRect = elm.getBoundingClientRect();

        return !(
        aRect.top + aRect.height < bRect.top ||
        aRect.top > bRect.top + bRect.height ||
        aRect.left + aRect.width < bRect.left ||
        aRect.left > bRect.left + bRect.width
        );
    }
    
    isTouchingOneOf(touchPositions, elm = this.elm) {
        for (var position of touchPositions) {
            if (this.isCollide(position, elm)) {
                return true;
            }
        }
        return false;
    }

    generateElement() {
        var editBoxElm = null;
        if (this.elm) {
            this.elm.remove();
        }
        this.elm = elements.createElementsFromJSON([
            {
                element: "div",
                className: "touchActionButton touchControlPosition",
                "data-position": this.side,
                styleProperties: {
                    "--button-x": this.xPos+"%",
                    "--button-y": this.yPos+"%",
                    "--button-width": this.width+"%",
                    "--button-height": this.height+"%",
                },
                children: [
                    {
                        element: "span",
                        textContent: this.name,
                    },
                ]
            }
        ])[0];
    }

    setInfo (id) {
        var targetId = id || this.id;
        if (this._lastid !== targetId) {
            this._lastid = targetId;
            this.name = KeyName[targetId] || "Unknown";
            this.pressNum = KeyNum[targetId] || 0;
            this.generateElement();
        }   
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
            yPos: this.yPos,
            width: this.width,
            height: this.height,
        };
    }

    editModeProcess (touchPositions, processState) {
        var elm = this.elm;

        if (processState.editing == )

        if (this.isTouchingOneOf(touchPositions, elm)) {
            elm.setAttribute("data-touching", "");
        } else {
            elm.removeAttribute("data-touching");
        }
    }

    process (touchPositions, processState) {
        if (this.editMode) {
            this.editModeProcess(touchPositions, processState);
            return;
        }


    }
}

module.exports = {
    TouchControlButton
};