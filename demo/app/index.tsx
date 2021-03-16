import * as React from "react";
import * as ReactDOM from "react-dom";

import {classList, spriteUrl, TestIcons, spriteEntries} from "svg-sprites/test";

console.log("Mein Hello World: AddFolder: %s, Path: %s", TestIcons.AddFolder, spriteUrl);
console.log("All entries: %O", spriteEntries);

const container = document.createElement("div");
container.style.fontSize = "100px";
document.body.append(container);

ReactDOM.render(<>
    {classList.map(icon => {
        return <React.Fragment key={icon}><div className={"icon_em " + icon} /><br /></React.Fragment>;
    })}
</>, container);