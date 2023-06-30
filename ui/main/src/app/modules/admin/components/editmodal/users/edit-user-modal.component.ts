/* Copyright (c) 2020, RTEi (http://www.rte-international.com)
 * Copyright (c) 2021-2023, RTE (http://www.rte-france.com)
 * See AUTHORS.txt
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * SPDX-License-Identifier: MPL-2.0
 * This file is part of the OperatorFabric project.
 */

import {
    AsyncValidatorFn,
    FormControl,
    FormGroup,
    Validators
} from '@angular/forms';
import {Component, Input, OnInit} from '@angular/core';
import {User} from '@ofModel/user.model';
import {NgbActiveModal} from '@ng-bootstrap/ng-bootstrap';
import {UserService} from 'app/business/services/users/user.service';
import {GroupsService} from 'app/business/services/users/groups.service';
import {EntitiesService} from 'app/business/services/users/entities.service';
import {debounceTime, distinctUntilChanged, first, map, switchMap} from 'rxjs/operators';
import {Observable, Subject} from 'rxjs';
import {MultiSelectConfig, MultiSelectOption} from '@ofModel/multiselect.model';

@Component({
    selector: 'of-edit-user-modal',
    templateUrl: './edit-user-modal.component.html',
    styleUrls: ['./edit-user-modal.component.scss']
})
export class EditUserModalComponent implements OnInit {
    userForm: FormGroup<{
        login: FormControl<string | null>,
        firstName: FormControl<string | null>,
        lastName: FormControl<string | null>,
        groups: FormControl<[] | null>,
        entities: FormControl<[] | null>,
        authorizedIPAddresses: FormControl<any | null>
    }>;

    entitiesMultiSelectOptions: Array<MultiSelectOption> = [];
    selectedEntities = [];
    entitiesMultiSelectConfig: MultiSelectConfig = {
        labelKey: 'admin.input.user.entities',
        placeholderKey: 'admin.input.selectEntityText',
        sortOptions: true
    };

    groupsMultiSelectOptions: Array<MultiSelectOption> = [];
    selectedGroups = [];
    groupsMultiSelectConfig: MultiSelectConfig = {
        labelKey: 'admin.input.user.groups',
        placeholderKey: 'admin.input.selectGroupText',
        sortOptions: true
    };


    @Input() row: User;


    constructor(
        private activeModal: NgbActiveModal,
        private crudService: UserService,
        private groupsService: GroupsService,
        private entitiesService: EntitiesService
    ) { }

    ngOnInit() {
        const uniqueLoginValidator = [];
        if (!this.row)
            // modal used for creating a new user
            uniqueLoginValidator.push(this.uniqueLoginValidatorFn());

        this.userForm = new FormGroup({
            login: new FormControl(
                '',
                [Validators.required, Validators.minLength(2), Validators.pattern(/^\S*$/)],
                uniqueLoginValidator
            ),
            firstName: new FormControl('', []),
            lastName: new FormControl('', []),
            groups: new FormControl([]),
            entities: new FormControl([]),
            authorizedIPAddresses: new FormControl(
                '',
                [Validators.pattern(/^((\d+(\.\d+){3}),?\s?)+$/)] )
        });

        if (this.row) {
            // If the modal is used for edition, initialize the modal with current data from this row

            // For 'simple' fields (where the value is directly displayed), we use the form's patching method
            const {login, firstName, lastName} = this.row;
            this.userForm.patchValue({login, firstName, lastName}, {onlySelf: false});

            if (this.row.authorizedIPAddresses) {
                this.userForm.patchValue({authorizedIPAddresses: this.row.authorizedIPAddresses.join(',')});
            }
            // Otherwise, we use the selectedItems property of the of-multiselect component
            this.selectedGroups = this.row.groups;
            this.selectedEntities = this.row.entities;
        }

        // Initialize value lists for Entities and Groups inputs
        this.entitiesService.getEntities().forEach((entity) => {
            const id = entity.id;
            let itemName = entity.name;
            if (!itemName) {
                itemName = id;
            }
            this.entitiesMultiSelectOptions.push(new MultiSelectOption(id, itemName));
        });

        this.groupsService.getGroups().forEach((group) => {
            const id = group.id;
            let itemName = group.name;
            if (!itemName) {
                itemName = id;
            }
            this.groupsMultiSelectOptions.push(new MultiSelectOption(id, itemName));
        });
    }

    update() {
        this.cleanForm();
        const isAuthorizedIPAdressesAString = this.userForm.value['authorizedIPAddresses'];
        const ipList = isAuthorizedIPAdressesAString && this.authorizedIPAddresses.value.trim().length > 0 ? this.authorizedIPAddresses.value.split(',') : [];
        this.authorizedIPAddresses.setValue(ipList.map((str) => str.trim()));
        this.crudService.update(this.userForm.value).subscribe(() => {
            this.activeModal.close('Update button clicked on user modal');
            // We call the activeModal "close" method and not "dismiss" to indicate that the modal was closed because the
            // user chose to perform an action (here, update the selected item).
            // This is important as code in the corresponding table components relies on the resolution of the
            // `NgbMobalRef.result` promise to trigger a refresh of the data shown on the table.
        });
    }

    isUniqueLogin(login: string): Observable<boolean> {
        const subject = new Subject<boolean>();

        if (login) {
            this.crudService.queryAllUsers().subscribe((users) => {
                if (users.filter((user) => user.login === login).length) subject.next(false);
                else subject.next(true);
            });
        } else subject.next(true);

        return subject.asObservable();
    }

    uniqueLoginValidatorFn(): AsyncValidatorFn {
        return (control) =>
            control.valueChanges.pipe(
                debounceTime(500),
                distinctUntilChanged(),
                switchMap((value) => this.isUniqueLogin(value)),
                map((unique: boolean) => (unique ? null : {uniqueLoginViolation: true})),
                first()
            ); // important to make observable finite
    }

    private cleanForm() {
        if (this.row) {
            this.userForm.value['login'] = this.row.login;
        }
        this.login.setValue((this.login.value as string).trim());
        if (this.lastName.value) this.lastName.setValue((this.lastName.value as string).trim());
        if (this.firstName.value) this.firstName.setValue((this.firstName.value as string).trim());
    }

    get login() {
        return this.userForm.get('login');
    }

    get firstName() {
        return this.userForm.get('firstName');
    }

    get lastName() {
        return this.userForm.get('lastName');
    }

    get groups() {
        return this.userForm.get('groups');
    }

    get entities() {
        return this.userForm.get('entities');
    }

    get authorizedIPAddresses() {
        return this.userForm.get('authorizedIPAddresses');
    }

    dismissModal(reason: string): void {
        this.activeModal.dismiss(reason);
    }
}
