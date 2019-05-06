import { IChaincodeModule } from "@prague/runtime-definitions";

export interface IExtension {
    /**
     * String representing the type of the extension.
     */
    type: string;
}
/**
 * Definitions of a shared extensions. Extensions follow a common model but enable custom behavior.
 */
export interface ISharedObjectExtension extends IChaincodeModule, IExtension {
    readonly snapshotFormatVersion: string;
}

/**
 * Class that contains a collection of collaboration extensions
 */
export class Registry<TExtension extends IExtension> {
    public extensions: TExtension[] = [];

    private readonly extensionsMap: { [key: string]: TExtension } = {};

    /**
     * Registers a new extension
     * @param extension - The extension to register
     */
    public register(extension: TExtension) {
        this.extensions.push(extension);
        this.extensionsMap[extension.type] = extension;
    }

    /**
     * Retrieves the extension with the given id
     * @param id - ID for the extension to retrieve
     */
    public getExtension(type: string): TExtension {
        if (!(type in this.extensionsMap)) {
            throw new Error("Extension not found");
        }

        return this.extensionsMap[type];
    }
}
