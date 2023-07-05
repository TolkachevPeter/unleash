/* tslint:disable */
/* eslint-disable */
/**
 * Unleash API
 * No description provided (generated by Openapi Generator https://github.com/openapitools/openapi-generator)
 *
 * The version of the OpenAPI document: 4.11.0-beta.2
 *
 *
 * NOTE: This class is auto generated by OpenAPI Generator (https://openapi-generator.tech).
 * https://openapi-generator.tech
 * Do not edit the class manually.
 */

import { exists, mapValues } from '../runtime';
/**
 *
 * @export
 * @interface CreateFeatureSchema
 */
export interface CreateFeatureSchema {
    /**
     *
     * @type {string}
     * @memberof CreateFeatureSchema
     */
    name: string;
    /**
     *
     * @type {string}
     * @memberof CreateFeatureSchema
     */
    epic: string;
    /**
     *
     * @type {string}
     * @memberof CreateFeatureSchema
     */
    type?: string;
    /**
     *
     * @type {string}
     * @memberof CreateFeatureSchema
     */
    description?: string;
    /**
     *
     * @type {boolean}
     * @memberof CreateFeatureSchema
     */
    impressionData?: boolean;
}

export function CreateFeatureSchemaFromJSON(json: any): CreateFeatureSchema {
    return CreateFeatureSchemaFromJSONTyped(json, false);
}

export function CreateFeatureSchemaFromJSONTyped(json: any, ignoreDiscriminator: boolean): CreateFeatureSchema {
    if ((json === undefined) || (json === null)) {
        return json;
    }
    return {
        'name': json['name'],
        'epic': json['epic'],
        'type': !exists(json, 'type') ? undefined : json['type'],
        'description': !exists(json, 'description') ? undefined : json['description'],
        'impressionData': !exists(json, 'impressionData') ? undefined : json['impressionData'],
    };
}

export function CreateFeatureSchemaToJSON(value?: CreateFeatureSchema | null): any {
    if (value === undefined) {
        return undefined;
    }
    if (value === null) {
        return null;
    }
    return {
        'name': value.name,
        'epic': value.epic,
        'type': value.type,
        'description': value.description,
        'impressionData': value.impressionData,
    };
}

