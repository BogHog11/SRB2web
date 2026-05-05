var { KeyNum, KeyName } = require("./keydef.js");
var { sendInput, getInputNames } = require("./handler.js");

var elements = require("../gp2/elements.js");

class TouchControlButton {
    static calculatePercentSize(x,y, cx = window.innerWidth, cy = window.innerHeight) {
        var percentX = (x/cx)*100;
        var percentY = (y/cy)*100;
        return {percentX, percentY};
    }

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
        this.tapLength = 0;
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

    isTouchingFirst(touchPositions, elm = this.elm) {
        if (touchPositions.length == 0) return false;
        return this.isCollide(touchPositions[0], elm);
    }

    generateElement() {
        var editBoxElm = null;
        if (this.elm) {
            this.elm.remove();
        }

        if (this.width < 10) {
            this.width = 10;
        }
        if (this.height < 10) {
            this.height = 10;
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

        this.editBoxElm = elements.createElementsFromJSON([
            {
                element: "div",
                className: "touchControlBox",
                "data-position": this.side,
                styleProperties: {
                    "--button-x": this.xPos+"%",
                    "--button-y": this.yPos+"%",
                    "--button-width": this.width+"%",
                    "--button-height": this.height+"%",
                },
            }
        ])[0];

        if (this.container) {
            this.append(this.container);
        }
    }

    setcssvar (property,value) {
        this.elm.style.setProperty(property,value);
        this.editBoxElm.style.setProperty(property,value);
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
        this.editBoxElm.remove();
        this.container = container;
        container.appendChild(this.elm);
        if (this.editMode) {
            container.appendChild(this.editBoxElm);
        }
    }

    destroy () {
        this.elm.remove();
        this.editBoxElm.remove();
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
        var editBox = this.editBoxElm;

        processState.disableDefault = !!processState.editing;

        if (!processState.editing) {
            if (this.isTouchingFirst(touchPositions, editBox)) {
                processState.resizing = true;
                processState.editing = this.randomId;
                
                // Save initial state
                processState.startWidth = this.width;
                processState.startHeight = this.height;
                processState.startX = touchPositions[0].left;
                processState.startY = touchPositions[0].top;
            }
            if (this.isTouchingFirst(touchPositions, elm) && !processState.editing) {
                processState.resizing = false;
                processState.editing = this.randomId;
                var bounding = elm.getBoundingClientRect();

                var anchorX = bounding.left; 
                var anchorY = bounding.bottom;

                var diffX = touchPositions[0].left - anchorX;
                var diffY = touchPositions[0].top - anchorY;

                if (this.side == "left") {
                    processState.offsetX = diffX; 
                } else {
                    processState.offsetX = -diffX;
                }

                processState.offsetY = diffY;
            }
        }
        if (processState.editing == this.randomId) {
            if (touchPositions.length == 0) {
                processState.editing = null;
                return;
            }
            var position = touchPositions[0];
            var newX = position.left - processState.offsetX;
            var newY = position.top - processState.offsetY;
            

            if (processState.resizing) {
                var deltaX = position.left - processState.startX;
                var deltaY = position.top - processState.startY;

                var percentDelta = TouchControlButton.calculatePercentSize(deltaX, deltaY);

                if (this.side == "left") {
                    this.width = Math.max(5, processState.startWidth + percentDelta.percentX);
                } else {
                    this.width = Math.max(5, processState.startWidth - percentDelta.percentX);
                }

                this.height = Math.max(5, processState.startHeight - percentDelta.percentY);
            } else {
                var percentSize = TouchControlButton.calculatePercentSize(newX, newY);
                percentSize.percentY = 100-percentSize.percentY;
                this.xPos = percentSize.percentX;
                this.yPos = percentSize.percentY;
            }
            this.setcssvar("--button-x", this.xPos + "%");
            this.setcssvar("--button-y", this.yPos + "%");
            this.setcssvar("--button-width", this.width + "%");
            this.setcssvar("--button-height", this.height + "%");
        
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

        processState.disableDefault = true;

        if (this.isTouchingOneOf(touchPositions)) {
            if (!this._justPressed) {
                sendInput(this.id, true);
                this._justPressed = true;
            }
        } else {
            if (this._justPressed) {
                sendInput(this.id, false);
                this._justPressed = false;
            }
        }
    }
}

module.exports = {
    TouchControlButton
};