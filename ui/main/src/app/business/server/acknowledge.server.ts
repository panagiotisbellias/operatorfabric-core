/* Copyright (c) 2023-2024, RTE (http://www.rte-france.com)
 * See AUTHORS.txt
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * SPDX-License-Identifier: MPL-2.0
 * This file is part of the OperatorFabric project.
 */

import {Observable} from 'rxjs';
import {ServerResponse} from './serverResponse';

export abstract class AcknowledgeServer {
    abstract postUserAcknowledgement(cardUid: string, entitiesAcks: string[]): Observable<ServerResponse<void>>;

    abstract deleteUserAcknowledgement(cardUid: string, entitiesAcks: string[]): Observable<ServerResponse<void>>;
}
