/* Copyright (c) 2018-2023, RTE (http://www.rte-france.com)
 * See AUTHORS.txt
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * SPDX-License-Identifier: MPL-2.0
 * This file is part of the OperatorFabric project.
 */

import * as fromRouter from '@ngrx/router-store';
import {RouterReducerState} from '@ngrx/router-store';
import {RouterStateUrl} from '@ofStore/states/router.state';
import {reducer as authenticationReducer} from '@ofStore/reducers/authentication.reducer';
import {ActionReducerMap, MetaReducer} from '@ngrx/store';
import {environment} from '@env/environment';
import {storeFreeze} from 'ngrx-store-freeze';
import {CardEffects} from '@ofEffects/card.effects';
import {AuthenticationEffects} from '@ofEffects/authentication.effects';
import {reducer as globalStyleReducer} from '@ofStore/reducers/global-style.reducer';
import {AuthState} from '@ofStates/authentication.state';
import {CustomRouterEffects} from '@ofEffects/custom-router.effects';

import {GlobalStyleState} from './states/global-style.state';

export interface AppState {
    router: RouterReducerState<RouterStateUrl>;
    authentication: AuthState;
    globalStyle: GlobalStyleState;
}

export const appEffects = [
    CardEffects,
    CustomRouterEffects,
    AuthenticationEffects
];

export const appReducer: ActionReducerMap<AppState> = {
    router: fromRouter.routerReducer,
    authentication: authenticationReducer,
    globalStyle: globalStyleReducer
};

export const appMetaReducers: MetaReducer<AppState>[] = !environment.production ? [storeFreeze] : [];

export const storeConfig = {
    metaReducers: appMetaReducers
};
